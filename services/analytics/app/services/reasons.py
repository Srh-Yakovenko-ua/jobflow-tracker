from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.reasons import Reasons, reasons
from app.metrics.reasons_summary import ReasonsSummary, reasons_summary
from app.services.search_events import load_scoped_events


async def search_reasons(
    engine: AsyncEngine,
    *,
    user_id: UUID,
    search_id: UUID | None,
    stage: str | None,
    now: datetime,
) -> Reasons:
    events = await load_scoped_events(engine, user_id=user_id, search_id=search_id)
    return reasons(events, stage=stage, now=now)


async def search_reasons_summary(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None, stage: str
) -> ReasonsSummary:
    events = await load_scoped_events(engine, user_id=user_id, search_id=search_id)
    return reasons_summary(events, stage=stage)
