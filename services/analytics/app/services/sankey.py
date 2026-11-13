from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.sankey import Sankey, SankeySplit, sankey
from app.services.search_events import load_search_events


async def search_sankey(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID, split: SankeySplit | None
) -> Sankey:
    _, events = await load_search_events(engine, user_id=user_id, search_id=search_id)
    return sankey(events, split=split)
