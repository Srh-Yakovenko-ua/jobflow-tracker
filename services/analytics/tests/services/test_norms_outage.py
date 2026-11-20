import time
from collections.abc import Awaitable, Callable

import pytest
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import DEPENDENCY_LIMITS
from app.core.errors import ServiceError
from app.services.match_validation import user_match_validation
from app.services.norms import user_norms
from app.services.reasons import search_reasons_summary
from app.services.resume_ab import user_resume_ab
from tests.factories import OUTAGES, USER_ID, Outage
from tests.repositories.test_unavailable import engine_on

pytestmark = [pytest.mark.anyio, pytest.mark.enable_socket]

type UserRead = Callable[[AsyncEngine], Awaitable[BaseModel]]

USER_READS: dict[str, UserRead] = {
    "norms": lambda engine: user_norms(engine, user_id=USER_ID),
    "reasons summary": lambda engine: search_reasons_summary(
        engine, user_id=USER_ID, search_id=None, stage="screening"
    ),
    "resume ab": lambda engine: user_resume_ab(engine, user_id=USER_ID),
    "match validation": lambda engine: user_match_validation(engine, user_id=USER_ID),
}


@pytest.mark.parametrize("read", list(USER_READS.values()), ids=list(USER_READS))
@pytest.mark.parametrize("outage", list(OUTAGES.values()), ids=list(OUTAGES))
async def test_answers_503_within_the_connect_limit_when_postgres_is_down(
    outage: Outage, read: UserRead
) -> None:
    with outage() as port:
        async with engine_on(port) as engine:
            started = time.monotonic()
            with pytest.raises(ServiceError) as raised:
                await read(engine)
            elapsed = time.monotonic() - started

    assert (raised.value.status, raised.value.detail) == (
        503,
        "Not reachable: postgres",
    )
    assert elapsed < DEPENDENCY_LIMITS.connect + 1
