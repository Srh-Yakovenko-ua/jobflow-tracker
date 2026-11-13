import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import DEPENDENCY_LIMITS
from app.core.resources import create_engine
from app.repositories.events import load_events
from app.services.readiness import DEPENDENCY_FAILURES
from tests.factories import (
    SEARCH_ID,
    USER_ID,
    closed_port,
    settings_for,
    silent_listener,
)

pytestmark = [pytest.mark.anyio, pytest.mark.enable_socket]


@asynccontextmanager
async def engine_on(port: int) -> AsyncIterator[AsyncEngine]:
    engine = create_engine(settings_for(postgres_port=port))
    try:
        yield engine
    finally:
        await engine.dispose()


async def test_lets_a_refused_connection_reach_the_caller() -> None:
    async with engine_on(closed_port()) as engine:
        with pytest.raises(DEPENDENCY_FAILURES):
            await load_events(engine, user_id=USER_ID, search_id=SEARCH_ID)


async def test_gives_up_on_a_silent_postgres_within_the_connect_limit() -> None:
    with silent_listener() as port:
        async with engine_on(port) as engine:
            started = time.monotonic()
            with pytest.raises((TimeoutError, *DEPENDENCY_FAILURES)):
                await load_events(engine, user_id=USER_ID, search_id=SEARCH_ID)
            elapsed = time.monotonic() - started

    assert elapsed < DEPENDENCY_LIMITS.connect + 1
