import time
from collections import deque
from collections.abc import Callable

from app.core.errors import AppError

WINDOW_SECONDS = 60.0


class RateLimiter:
    def __init__(
        self, limit_per_minute: int, *, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._limit = limit_per_minute
        self._clock = clock
        self._calls: deque[float] = deque()

    def acquire(self) -> None:
        now = self._clock()
        while self._calls and now - self._calls[0] >= WINDOW_SECONDS:
            self._calls.popleft()
        if len(self._calls) >= self._limit:
            raise AppError(429, detail=f"More than {self._limit} AI calls a minute")
        self._calls.append(now)
