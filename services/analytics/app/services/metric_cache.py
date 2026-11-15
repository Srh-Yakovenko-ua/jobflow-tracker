from collections.abc import Awaitable, Callable
from typing import NamedTuple
from uuid import UUID

from loguru import logger
from pydantic import TypeAdapter
from redis.asyncio import Redis

from app.core.enums import load_domain_enums
from app.core.metrics import CACHE_LOOKUPS, METRIC_COMPUTE_SECONDS
from app.core.tracing import metric_span
from app.services.cache import (
    REDIS_FAILURES,
    cache_aside,
    redis_down,
    within_ping_limit,
)


class CacheScope(NamedTuple):
    user_id: UUID
    metric: str
    params_hash: str


def entry_key(scope: CacheScope, *, version: int) -> str:
    return load_domain_enums().analytics_cache.entry_key.format(
        userId=scope.user_id,
        version=version,
        metric=scope.metric,
        paramsHash=scope.params_hash,
    )


async def stored_version(redis: Redis, *, user_id: UUID) -> int:
    key = load_domain_enums().analytics_cache.version_key.format(userId=user_id)
    return int(await within_ping_limit(redis.get(key)) or 0)


def looked_up(scope: CacheScope, *, result: str) -> None:
    logger.info("analytics cache", metric=scope.metric, result=result)
    CACHE_LOOKUPS.labels(metric=scope.metric, result=result).inc()


async def timed[T](scope: CacheScope, compute: Callable[[], Awaitable[T]]) -> T:
    with (
        metric_span(scope.metric),
        METRIC_COMPUTE_SECONDS.labels(metric=scope.metric).time(),
    ):
        return await compute()


async def cached_body[T](
    redis: Redis,
    *,
    scope: CacheScope,
    adapter: TypeAdapter[T],
    compute: Callable[[], Awaitable[T]],
) -> bytes:
    try:
        version = await stored_version(redis, user_id=scope.user_id)
    except REDIS_FAILURES as error:
        redis_down(error)
        looked_up(scope, result="bypass")
        return adapter.dump_json(await timed(scope, compute), by_alias=True)
    computed = False

    async def missed() -> T:
        nonlocal computed
        computed = True
        return await timed(scope, compute)

    key = entry_key(scope, version=version)
    answer = await cache_aside(redis, key=key, adapter=adapter, compute=missed)
    looked_up(scope, result="miss" if computed else "hit")
    return adapter.dump_json(answer, by_alias=True)
