import time
from typing import Any

import pytest
from pydantic import TypeAdapter

from app.core.config import DEPENDENCY_LIMITS
from app.core.resources import create_redis
from app.metrics.norms import Norms
from app.services.metric_cache import CacheScope, cached_body
from tests.factories import OUTAGES, USER_ID, Outage, settings_for
from tests.services.test_cache import Computation, FakeRedis

pytestmark = pytest.mark.anyio

PARAMS_HASH = "5f0c2a9e41b7d3c8"
SCOPE = CacheScope(user_id=USER_ID, metric="funnel", params_hash=PARAMS_HASH)
VERSION_KEY = f"analytics:{USER_ID}:version"
COMPUTED_BODY = b'{"stageNormDays":{"final":17},"medianDaysToOffer":null}'
STORED_BODY = b'{"stageNormDays":{"final":99},"medianDaysToOffer":1}'


def entry(version: int) -> str:
    return f"analytics:{USER_ID}:v{version}:funnel:{PARAMS_HASH}"


async def body_of(redis: Any, compute: Computation) -> bytes:
    return await cached_body(
        redis, scope=SCOPE, adapter=TypeAdapter(Norms), compute=compute
    )


async def test_answers_the_stored_body_of_the_current_version_without_computing() -> (
    None
):
    redis = FakeRedis({VERSION_KEY: b"3", entry(3): STORED_BODY})
    compute = Computation()

    assert (await body_of(redis, compute), compute.calls) == (STORED_BODY, 0)


async def test_recomputes_once_the_worker_bumps_the_version() -> None:
    redis = FakeRedis({VERSION_KEY: b"4", entry(3): STORED_BODY})
    compute = Computation()

    assert (await body_of(redis, compute), compute.calls) == (COMPUTED_BODY, 1)
    assert redis.bodies[entry(4)] == COMPUTED_BODY


async def test_stores_under_version_0_while_no_version_was_bumped() -> None:
    redis = FakeRedis()

    assert await body_of(redis, Computation()) == COMPUTED_BODY
    assert (redis.bodies, redis.ttls) == (
        {entry(0): COMPUTED_BODY},
        {entry(0): 3600},
    )


async def test_recomputes_a_stored_body_of_an_older_shape() -> None:
    redis = FakeRedis({VERSION_KEY: b"3", entry(3): b'{"stageNorms":{"final":17}}'})
    compute = Computation()

    assert (await body_of(redis, compute), compute.calls) == (COMPUTED_BODY, 1)
    assert redis.bodies[entry(3)] == COMPUTED_BODY


@pytest.mark.enable_socket
@pytest.mark.parametrize("outage", list(OUTAGES.values()), ids=list(OUTAGES))
async def test_computes_without_storing_when_the_version_read_fails(
    outage: Outage,
) -> None:
    compute = Computation()
    with outage() as port:
        redis = create_redis(settings_for(redis_port=port))
        started = time.monotonic()
        body = await body_of(redis, compute)
        elapsed = time.monotonic() - started
        await redis.aclose()

    assert (body, compute.calls) == (COMPUTED_BODY, 1)
    assert elapsed < DEPENDENCY_LIMITS.ping + 1
