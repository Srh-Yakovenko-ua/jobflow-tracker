import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Final

from loguru import logger
from pydantic import BaseModel, ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import DEPENDENCY_LIMITS

CACHE_TTL_SECONDS: Final = 3600
EPOCH: Final = datetime(1970, 1, 1, tzinfo=UTC)
REDIS_FAILURES: Final = (TimeoutError, RedisError, OSError)


def epoch_ms(moment: datetime) -> int:
    return (moment - EPOCH) // timedelta(milliseconds=1)


def stamp_part(stamp: datetime | None) -> str:
    return "none" if stamp is None else str(epoch_ms(stamp))


async def within_ping_limit[T](call: Awaitable[T]) -> T:
    async with asyncio.timeout(DEPENDENCY_LIMITS.ping):
        return await call


def redis_down(error: Exception) -> None:
    logger.warning("dependency down", dependency="redis", error=type(error).__name__)


async def store(redis: Redis, *, key: str, body: str) -> None:
    try:
        await within_ping_limit(redis.set(key, body, ex=CACHE_TTL_SECONDS))
    except REDIS_FAILURES as error:
        redis_down(error)


def readable[M: BaseModel](cached: bytes | str | None, *, model: type[M]) -> M | None:
    if cached is None:
        return None
    try:
        return model.model_validate_json(cached)
    except ValidationError:
        logger.warning("cache body unreadable", model=model.__name__)
        return None


async def cache_aside[M: BaseModel](
    redis: Redis, *, key: str, model: type[M], compute: Callable[[], Awaitable[M]]
) -> M:
    try:
        cached = await within_ping_limit(redis.get(key))
    except REDIS_FAILURES as error:
        redis_down(error)
        return await compute()
    hit = readable(cached, model=model)
    if hit is not None:
        return hit
    answer = await compute()
    await store(redis, key=key, body=answer.model_dump_json(by_alias=True))
    return answer
