from dataclasses import dataclass, field
from typing import Any

import pytest
from pydantic import TypeAdapter
from redis.exceptions import ConnectionError as RedisConnectionError

from app.metrics.norms import Norms
from app.services.cache import cache_aside
from tests.factories import USER_ID

pytestmark = pytest.mark.anyio

KEY = f"analytics:{USER_ID}:v1:norms:5f0c2a9e41b7d3c8"
COMPUTED = Norms(stage_norm_days={"final": 17}, median_days_to_offer=None)
STORED = Norms(stage_norm_days={"final": 99}, median_days_to_offer=1)


@dataclass
class FakeRedis:
    bodies: dict[str, bytes] = field(default_factory=dict)
    ttls: dict[str, int] = field(default_factory=dict)
    down: bool = False

    async def get(self, key: str) -> bytes | None:
        if self.down:
            raise RedisConnectionError("refused")
        return self.bodies.get(key)

    async def set(self, key: str, body: str, *, ex: int) -> None:
        if self.down:
            raise RedisConnectionError("refused")
        self.bodies[key] = body.encode()
        self.ttls[key] = ex


@dataclass
class Computation:
    calls: int = 0

    async def __call__(self) -> Norms:
        self.calls += 1
        return COMPUTED


async def cached(redis: FakeRedis, compute: Computation) -> Any:
    return await cache_aside(
        redis, key=KEY, adapter=TypeAdapter(Norms), compute=compute
    )


async def test_answers_the_stored_body_without_computing() -> None:
    redis = FakeRedis({KEY: STORED.model_dump_json(by_alias=True).encode()})
    compute = Computation()

    assert (await cached(redis, compute), compute.calls) == (STORED, 0)


UNREADABLE_BODIES = {
    "nothing stored": {},
    "half-written body": {KEY: b'{"stageNormDays":{"fin'},
    "body of an older shape": {KEY: b'{"stageNorms":{"final":17}}'},
}


@pytest.mark.parametrize(
    "bodies", UNREADABLE_BODIES.values(), ids=UNREADABLE_BODIES.keys()
)
async def test_computes_a_miss_and_stores_it_by_alias_for_an_hour(
    bodies: dict[str, bytes],
) -> None:
    redis = FakeRedis(dict(bodies))
    compute = Computation()

    assert (await cached(redis, compute), compute.calls) == (COMPUTED, 1)
    assert (redis.bodies, redis.ttls) == (
        {KEY: b'{"stageNormDays":{"final":17},"medianDaysToOffer":null}'},
        {KEY: 3600},
    )


async def test_computes_the_answer_while_redis_is_down() -> None:
    compute = Computation()
    redis = FakeRedis(down=True)

    assert (await cached(redis, compute), compute.calls) == (COMPUTED, 1)
    assert redis.bodies == {}
