from datetime import datetime
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.norms import Norms, norms
from app.repositories.applications import load_latest_change
from app.repositories.events import load_user_events
from app.services.cache import cache_aside, stamp_part
from app.services.search_events import postgres_reads


def norms_key(*, user_id: UUID, stamp: datetime | None) -> str:
    return f"analytics:{user_id}:norms:{stamp_part(stamp)}"


async def cached_norms(engine: AsyncEngine, redis: Redis, *, user_id: UUID) -> Norms:
    async def computed() -> Norms:
        async with postgres_reads():
            events = await load_user_events(engine, user_id=user_id)
        return norms(events)

    async with postgres_reads():
        stamp = await load_latest_change(engine, user_id=user_id)
    key = norms_key(user_id=user_id, stamp=stamp)
    return await cache_aside(redis, key=key, model=Norms, compute=computed)
