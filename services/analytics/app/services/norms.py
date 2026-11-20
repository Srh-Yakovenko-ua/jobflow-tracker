from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.norms import Norms, norms
from app.repositories.events import load_user_events
from app.services.search_events import postgres_reads


async def user_norms(engine: AsyncEngine, *, user_id: UUID) -> Norms:
    async with postgres_reads():
        events = await load_user_events(engine, user_id=user_id)
    return norms(events)
