from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import DEPENDENCY_LIMITS, Settings


def create_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        settings.async_database_url,
        pool_timeout=DEPENDENCY_LIMITS.connect,
        connect_args={
            "timeout": DEPENDENCY_LIMITS.connect,
            "command_timeout": DEPENDENCY_LIMITS.query,
        },
    )


def create_redis(settings: Settings) -> Redis:
    return Redis.from_url(
        settings.redis_url,
        socket_connect_timeout=DEPENDENCY_LIMITS.connect,
        socket_timeout=DEPENDENCY_LIMITS.query,
    )
