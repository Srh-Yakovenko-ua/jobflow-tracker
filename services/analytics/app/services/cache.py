import asyncio
from collections.abc import Awaitable, Callable
from typing import Final

from loguru import logger
from pydantic import TypeAdapter, ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import DEPENDENCY_LIMITS
from app.core.enums import load_domain_enums

CACHE_TTL_SECONDS: Final = load_domain_enums().analytics_cache.ttl_seconds
REDIS_FAILURES: Final = (TimeoutError, RedisError, OSError)


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


def readable[T](cached: bytes | str | None, *, adapter: TypeAdapter[T]) -> T | None:
    if cached is None:
        return None
    try:
        return adapter.validate_json(cached)
    except ValidationError:
        logger.warning("cache body unreadable")
        return None


async def cache_aside[T](
    redis: Redis,
    *,
    key: str,
    adapter: TypeAdapter[T],
    compute: Callable[[], Awaitable[T]],
) -> T:
    try:
        cached = await within_ping_limit(redis.get(key))
    except REDIS_FAILURES as error:
        redis_down(error)
        return await compute()
    hit = readable(cached, adapter=adapter)
    if hit is not None:
        return hit
    answer = await compute()
    await store(redis, key=key, body=adapter.dump_json(answer, by_alias=True).decode())
    return answer
