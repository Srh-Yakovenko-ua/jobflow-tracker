from itertools import pairwise
from math import inf

from hypothesis import given, settings
from hypothesis import strategies as st

from app.metrics.forecast import FORECAST_SEED, Forecast, WhatIf
from tests.metrics.test_forecast import ok_forecast

GRID_RATES = (0, 0.5, 1, 2, 4, 8, 16)

rates = st.floats(min_value=0, max_value=32, allow_nan=False)


def at_rate(rate: float) -> Forecast:
    return ok_forecast(seed=FORECAST_SEED, what_if=WhatIf(applications_per_week=rate))


def weeks_of(result: Forecast) -> list[float]:
    quantiles = [result.median_weeks, result.interval.low, result.interval.high]
    return [inf if weeks is None else weeks for weeks in quantiles]


def assert_not_later(slower: Forecast, faster: Forecast) -> None:
    assert all(
        sooner <= later
        for sooner, later in zip(weeks_of(faster), weeks_of(slower), strict=True)
    )
    assert faster.within_four_weeks >= slower.within_four_weeks
    assert faster.within_eight_weeks >= slower.within_eight_weeks


@settings(deadline=None, derandomize=True, max_examples=20)
@given(pair=st.tuples(rates, rates).filter(lambda pair: pair[0] < pair[1]))
def test_never_forecasts_a_later_offer_for_more_applications_a_week(
    pair: tuple[float, float],
) -> None:
    slower, faster = (at_rate(rate) for rate in pair)

    assert_not_later(slower, faster)


def test_never_forecasts_a_later_offer_along_the_rate_grid() -> None:
    for slower, faster in pairwise(at_rate(rate) for rate in GRID_RATES):
        assert_not_later(slower, faster)
