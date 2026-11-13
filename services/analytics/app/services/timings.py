from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.timings import Timings, timings
from app.repositories.timeline import load_followups
from app.services.search_events import load_scoped_events, postgres_reads


async def search_timings(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None
) -> Timings:
    events = await load_scoped_events(engine, user_id=user_id, search_id=search_id)
    async with postgres_reads():
        followups = await load_followups(engine, user_id=user_id, search_id=search_id)
    return timings(events, followups=followups)
