from datetime import datetime
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.reasons_summary import ReasonsSummary, reasons_summary
from app.repositories.applications import load_latest_change
from app.repositories.searches import load_active_search_id
from app.services.cache import cache_aside, stamp_part
from app.services.search_events import load_scoped_events, postgres_reads


def reasons_summary_key(
    *, user_id: UUID, stage: str, search_id: UUID | None, stamp: datetime | None
) -> str:
    scope = "none" if search_id is None else str(search_id)
    return f"analytics:{user_id}:reasons-summary:{stage}:{scope}:{stamp_part(stamp)}"


async def cached_reasons_summary(
    engine: AsyncEngine,
    redis: Redis,
    *,
    user_id: UUID,
    search_id: UUID | None,
    stage: str,
) -> ReasonsSummary:
    async def computed() -> ReasonsSummary:
        events = await load_scoped_events(engine, user_id=user_id, search_id=search_id)
        return reasons_summary(events, stage=stage)

    async with postgres_reads():
        stamp = await load_latest_change(engine, user_id=user_id)
        scope = search_id or await load_active_search_id(engine, user_id=user_id)
    key = reasons_summary_key(
        user_id=user_id, stage=stage, search_id=scope, stamp=stamp
    )
    return await cache_aside(redis, key=key, model=ReasonsSummary, compute=computed)
