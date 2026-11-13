from datetime import datetime
from uuid import UUID

import pandas as pd
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.errors import ServiceError
from app.metrics.funnel import Funnel, funnel
from app.metrics.kpis import SearchPeriod
from app.repositories.events import load_events
from app.repositories.searches import load_search
from app.services.readiness import DEPENDENCY_FAILURES

POSTGRES_UNREACHABLE = "Not reachable: postgres"


def search_period(search: pd.DataFrame) -> SearchPeriod:
    row = search.iloc[0]
    finished_at = row["finished_at"]
    return SearchPeriod(
        started_at=row["started_at"],
        finished_at=None if pd.isna(finished_at) else finished_at,
        timezone=row["timezone"],
    )


async def search_funnel(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID, now: datetime
) -> Funnel:
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
    return funnel(events, period=search_period(search), now=now)
