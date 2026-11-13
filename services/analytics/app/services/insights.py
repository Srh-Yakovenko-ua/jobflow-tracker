from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.insights.engine import Insights, insights
from app.metrics.insights.inputs import insight_metrics
from app.repositories.resume_versions import load_version_links
from app.services.search_events import postgres_reads, scoped_events_with_origins


async def search_insights(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None, now: datetime
) -> Insights:
    events, origins = await scoped_events_with_origins(
        engine, user_id=user_id, search_id=search_id
    )
    async with postgres_reads():
        links = await load_version_links(engine, user_id=user_id)
    return insights(insight_metrics(events, origins=origins, links=links, now=now))
