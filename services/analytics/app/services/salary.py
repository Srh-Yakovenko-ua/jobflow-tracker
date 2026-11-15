from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.salary import Salary, salary
from app.repositories.applications import load_salaries
from app.services.search_events import load_scoped_events, postgres_reads


async def search_salary(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None, now: datetime
) -> Salary:
    events = await load_scoped_events(engine, user_id=user_id, search_id=search_id)
    async with postgres_reads():
        salaries = await load_salaries(engine, user_id=user_id, search_id=search_id)
    return salary(events, salaries=salaries, now=now)
