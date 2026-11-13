import asyncio
from collections.abc import Awaitable
from datetime import UTC, datetime, timedelta
from typing import Final
from uuid import UUID

from loguru import logger
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import DEPENDENCY_LIMITS
from app.metrics.reasons_summary import ReasonsSummary, reasons_summary
from app.repositories.applications import load_latest_change
from app.repositories.searches import load_active_search_id
from app.services.search_events import load_scoped_events, postgres_reads

SUMMARY_TTL_SECONDS: Final = 3600
EPOCH: Final = datetime(1970, 1, 1, tzinfo=UTC)
REDIS_FAILURES: Final = (TimeoutError, RedisError, OSError)


def epoch_ms(moment: datetime) -> int:
    return (moment - EPOCH) // timedelta(milliseconds=1)


def reasons_summary_key(
    *, user_id: UUID, stage: str, search_id: UUID | None, stamp: datetime | None
) -> str:
    scope = "none" if search_id is None else str(search_id)
    moment = "none" if stamp is None else str(epoch_ms(stamp))
    return f"analytics:{user_id}:reasons-summary:{stage}:{scope}:{moment}"


async def within_ping_limit[T](call: Awaitable[T]) -> T:
    async with asyncio.timeout(DEPENDENCY_LIMITS.ping):
        return await call


def redis_down(error: Exception) -> None:
    logger.warning("dependency down", dependency="redis", error=type(error).__name__)


async def store(redis: Redis, *, key: str, summary: ReasonsSummary) -> None:
    body = summary.model_dump_json(by_alias=True)
    try:
        await within_ping_limit(redis.set(key, body, ex=SUMMARY_TTL_SECONDS))
    except REDIS_FAILURES as error:
        redis_down(error)


async def cached_reasons_summary(
    engine: AsyncEngine,
    redis: Redis,
    *,
    user_id: UUID,
    search_id: UUID | None,
    stage: str,
) -> ReasonsSummary:
    async def computed() -> ReasonsSummary:
        events = await load_scoped_events(engine, user_id=user_id, search_id=search_id)
        return reasons_summary(events, stage=stage)

    async with postgres_reads():
        stamp = await load_latest_change(engine, user_id=user_id)
        scope = search_id or await load_active_search_id(engine, user_id=user_id)
    key = reasons_summary_key(
        user_id=user_id, stage=stage, search_id=scope, stamp=stamp
    )
    try:
        cached = await within_ping_limit(redis.get(key))
    except REDIS_FAILURES as error:
        redis_down(error)
        return await computed()
    if cached is not None:
        return ReasonsSummary.model_validate_json(cached)
    summary = await computed()
    await store(redis, key=key, summary=summary)
    return summary
