import time
from collections.abc import Awaitable, Callable

import pytest
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import DEPENDENCY_LIMITS
from app.core.errors import ServiceError
from app.core.resources import create_redis
from app.services.norms import cached_norms
from app.services.resume_ab import user_resume_ab
from tests.factories import OUTAGES, USER_ID, Outage, closed_port, settings_for
from tests.repositories.test_unavailable import engine_on

pytestmark = [pytest.mark.anyio, pytest.mark.enable_socket]

type UserRead = Callable[[AsyncEngine, Redis], Awaitable[BaseModel]]

USER_READS: dict[str, UserRead] = {
    "norms": lambda engine, redis: cached_norms(engine, redis, user_id=USER_ID),
    "resume ab": lambda engine, _: user_resume_ab(engine, user_id=USER_ID),
}


@pytest.mark.parametrize("read", list(USER_READS.values()), ids=list(USER_READS))
@pytest.mark.parametrize("outage", list(OUTAGES.values()), ids=list(OUTAGES))
async def test_answers_503_within_the_connect_limit_when_postgres_is_down(
    outage: Outage, read: UserRead
) -> None:
    redis = create_redis(settings_for(redis_port=closed_port()))
    with outage() as port:
        async with engine_on(port) as engine:
            started = time.monotonic()
            with pytest.raises(ServiceError) as raised:
                await read(engine, redis)
            elapsed = time.monotonic() - started
    await redis.aclose()

    assert (raised.value.status, raised.value.detail) == (
        503,
        "Not reachable: postgres",
    )
    assert elapsed < DEPENDENCY_LIMITS.connect + 1
