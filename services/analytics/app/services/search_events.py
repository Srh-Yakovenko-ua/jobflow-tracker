from uuid import UUID

import pandas as pd
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.errors import ServiceError
from app.repositories.events import load_events
from app.repositories.searches import load_search
from app.services.readiness import DEPENDENCY_FAILURES

POSTGRES_UNREACHABLE = "Not reachable: postgres"


async def load_search_events(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID
) -> tuple[pd.DataFrame, pd.DataFrame]:
    try:
        search = await load_search(engine, user_id=user_id, search_id=search_id)
        if search.empty:
            raise ServiceError(404)
        events = await load_events(engine, user_id=user_id, search_id=search_id)
    except (TimeoutError, *DEPENDENCY_FAILURES) as error:
        logger.warning(
            "dependency down", dependency="postgres", error=type(error).__name__
        )
        raise ServiceError(503, detail=POSTGRES_UNREACHABLE) from error
    return search, events
