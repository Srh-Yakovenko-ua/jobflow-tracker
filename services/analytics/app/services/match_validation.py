from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.match_validation import MatchValidation, match_validation
from app.repositories.applications import load_match_scores
from app.repositories.events import load_user_events
from app.services.search_events import postgres_reads


async def user_match_validation(
    engine: AsyncEngine, *, user_id: UUID
) -> MatchValidation:
    async with postgres_reads():
        events = await load_user_events(engine, user_id=user_id)
        scores = await load_match_scores(engine, user_id=user_id)
    return match_validation(events, scores=scores)
