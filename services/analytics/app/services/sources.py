from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.sources import Sources, sources
from app.services.search_events import scoped_events_with_origins


async def search_sources(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None
) -> Sources:
    events, origins = await scoped_events_with_origins(
        engine, user_id=user_id, search_id=search_id
    )
    return sources(events, origins=origins)
