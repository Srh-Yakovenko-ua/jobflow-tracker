from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from app.metrics.norms import Norms
from app.services.cache import cache_aside
from app.services.norms import norms_key
from tests.factories import USER_ID

pytestmark = pytest.mark.anyio

KEY = f"analytics:{USER_ID}:norms:1793610000123"
STAMP = datetime(2026, 11, 2, 9, 0, 0, 123456, tzinfo=UTC)
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
    return await cache_aside(redis, key=KEY, model=Norms, compute=compute)


async def test_answers_the_stored_body_without_computing() -> None:
    redis = FakeRedis({KEY: STORED.model_dump_json(by_alias=True).encode()})
    compute = Computation()

    assert (await cached(redis, compute), compute.calls) == (STORED, 0)


async def test_computes_a_miss_and_stores_it_by_alias_for_an_hour() -> None:
    redis = FakeRedis()
    compute = Computation()

    assert (await cached(redis, compute), compute.calls) == (COMPUTED, 1)
    assert (redis.bodies, redis.ttls) == (
        {KEY: b'{"stageNormDays":{"final":17},"medianDaysToOffer":null}'},
        {KEY: 3600},
    )


async def test_computes_the_answer_while_redis_is_down() -> None:
    compute = Computation()

    assert (await cached(FakeRedis(down=True), compute), compute.calls) == (
        COMPUTED,
        1,
    )


@pytest.mark.parametrize(
    ("stamp", "key"),
    [(STAMP, KEY), (None, f"analytics:{USER_ID}:norms:none")],
    ids=["changed", "nothing recorded yet"],
)
def test_keys_the_norms_by_user_and_last_change_in_epoch_ms(
    stamp: datetime | None, key: str
) -> None:
    assert norms_key(user_id=USER_ID, stamp=stamp) == key
