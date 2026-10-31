import pytest

from app.core.errors import AppError
from app.core.limiter import RateLimiter


class ManualClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_refuses_the_call_over_the_limit_inside_one_minute() -> None:
    clock = ManualClock()
    limiter = RateLimiter(2, clock=clock)
    limiter.acquire()
    clock.now += 30
    limiter.acquire()

    clock.now += 29.9
    with pytest.raises(AppError) as refused:
        limiter.acquire()

    assert refused.value.status == 429


def test_allows_a_call_again_once_the_oldest_leaves_the_window() -> None:
    clock = ManualClock()
    limiter = RateLimiter(2, clock=clock)
    limiter.acquire()
    clock.now += 30
    limiter.acquire()
    clock.now += 30
    limiter.acquire()

    clock.now += 0.1
    with pytest.raises(AppError):
        limiter.acquire()
