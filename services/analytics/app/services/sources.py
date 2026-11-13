from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.sources import Sources, sources
from app.repositories.applications import load_application_sources
from app.services.search_events import load_scoped_events, postgres_reads


async def search_sources(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None
) -> Sources:
    events = await load_scoped_events(engine, user_id=user_id, search_id=search_id)
    async with postgres_reads():
        origins = await load_application_sources(
            engine, user_id=user_id, search_id=search_id
        )
    return sources(events, origins=origins)
