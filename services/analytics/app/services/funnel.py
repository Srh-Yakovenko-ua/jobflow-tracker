from datetime import datetime
from uuid import UUID

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.funnel import Funnel, funnel
from app.metrics.kpis import SearchPeriod
from app.services.search_events import load_search_events


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
    search, events = await load_search_events(
        engine, user_id=user_id, search_id=search_id
    )
    return funnel(events, period=search_period(search), now=now)
