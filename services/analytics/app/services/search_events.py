from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

import pandas as pd
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.errors import ServiceError
from app.repositories.events import load_events
from app.repositories.searches import load_search
from app.services.readiness import DEPENDENCY_FAILURES

POSTGRES_UNREACHABLE = "Not reachable: postgres"


@asynccontextmanager
async def postgres_reads() -> AsyncIterator[None]:
    try:
        yield
    except (TimeoutError, *DEPENDENCY_FAILURES) as error:
        logger.warning(
            "dependency down", dependency="postgres", error=type(error).__name__
        )
        raise ServiceError(503, detail=POSTGRES_UNREACHABLE) from error


async def load_search_events(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID
) -> tuple[pd.DataFrame, pd.DataFrame]:
    async with postgres_reads():
        search = await load_search(engine, user_id=user_id, search_id=search_id)
        if search.empty:
            raise ServiceError(404)
        events = await load_events(engine, user_id=user_id, search_id=search_id)
    return search, events


async def load_scoped_events(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None
) -> pd.DataFrame:
    if search_id is not None:
        _, events = await load_search_events(
            engine, user_id=user_id, search_id=search_id
        )
        return events
    async with postgres_reads():
        return await load_events(engine, user_id=user_id, search_id=None)
