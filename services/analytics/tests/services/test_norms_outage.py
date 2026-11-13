import time

import pytest

from app.core.config import DEPENDENCY_LIMITS
from app.core.errors import ServiceError
from app.core.resources import create_redis
from app.services.norms import cached_norms
from tests.factories import OUTAGES, USER_ID, Outage, closed_port, settings_for
from tests.repositories.test_unavailable import engine_on

pytestmark = [pytest.mark.anyio, pytest.mark.enable_socket]


@pytest.mark.parametrize("outage", list(OUTAGES.values()), ids=list(OUTAGES))
async def test_answers_503_within_the_connect_limit_when_postgres_is_down(
    outage: Outage,
) -> None:
    redis = create_redis(settings_for(redis_port=closed_port()))
    with outage() as port:
        async with engine_on(port) as engine:
            started = time.monotonic()
            with pytest.raises(ServiceError) as raised:
                await cached_norms(engine, redis, user_id=USER_ID)
            elapsed = time.monotonic() - started
    await redis.aclose()

    assert (raised.value.status, raised.value.detail) == (
        503,
        "Not reachable: postgres",
    )
    assert elapsed < DEPENDENCY_LIMITS.connect + 1
