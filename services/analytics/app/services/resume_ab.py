from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.resume_ab import ResumeAb, resume_ab
from app.repositories.events import load_user_events
from app.repositories.resume_versions import load_version_links
from app.services.search_events import postgres_reads


async def user_resume_ab(engine: AsyncEngine, *, user_id: UUID) -> ResumeAb:
    async with postgres_reads():
        events = await load_user_events(engine, user_id=user_id)
        links = await load_version_links(engine, user_id=user_id)
    return resume_ab(events, links=links)
