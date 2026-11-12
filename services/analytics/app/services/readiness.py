import asyncio
from collections.abc import Awaitable, Callable, Mapping

from loguru import logger
from redis.exceptions import RedisError
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import DEPENDENCY_LIMITS

type Probe = Callable[[], Awaitable[object]]

DEPENDENCY_FAILURES = (OSError, SQLAlchemyError, RedisError)


async def answers(dependency: str, probe: Probe) -> bool:
    try:
        async with asyncio.timeout(DEPENDENCY_LIMITS.ping):
            await probe()
    except DEPENDENCY_FAILURES as error:
        logger.warning(
            "dependency down", dependency=dependency, error=type(error).__name__
        )
        return False
    return True


class ReadinessService:
    def __init__(self, probes: Mapping[str, Probe]) -> None:
        self.probes = probes

    async def unreachable(self) -> list[str]:
        answered = await asyncio.gather(
            *(answers(name, probe) for name, probe in self.probes.items())
        )
        return [name for name, up in zip(self.probes, answered, strict=True) if not up]
