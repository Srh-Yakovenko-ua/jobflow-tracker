import time
from datetime import datetime
from typing import Any

import pandas as pd
import pytest

from app.metrics.data_rules import clean_events
from app.metrics.forecast import Forecast, WhatIf, forecast
from app.metrics.forecast_inputs import (
    PassCounts,
    applications_per_week,
    in_flight,
    stage_pass_counts,
)
from app.metrics.journeys import journeys
from app.metrics.offer_simulation import Improvement
from app.metrics.rate import Insufficient
from tests.factories import day
from tests.metrics.forecast_fixtures import (
    FORECAST_BODY,
    FORECAST_NOW,
    HISTORY,
    OLD_GHOSTS,
    OPEN_AT_APPLIED,
    REJECTED_AT_APPLIED,
    history_frame,
)

LIMIT_SECONDS = 0.3
SIXTY_APPLICATIONS = (*HISTORY, *HISTORY, (OPEN_AT_APPLIED, (61, 64, 67, 69)))


def rows_of(events: pd.DataFrame) -> pd.DataFrame:
    return journeys(clean_events(events))


def body_of(events: pd.DataFrame, **what_if: Any) -> dict[str, Any]:
    result = forecast(events, now=FORECAST_NOW, what_if=WhatIf(**what_if))
    return result.model_dump(by_alias=True)


def ok_forecast(*, seed: int, what_if: WhatIf) -> Forecast:
    result = forecast(history_frame(), now=FORECAST_NOW, what_if=what_if, seed=seed)
    assert isinstance(result, Forecast)
    return result


def test_counts_passes_and_failures_per_active_stage_leaving_ghosted_and_open_out() -> (
    None
):
    assert stage_pass_counts(rows_of(history_frame())) == PassCounts(
        successes=(15, 7, 3, 2), failures=(5, 7, 3, 1)
    )


def test_leaves_the_pass_counts_and_the_forecast_unchanged_by_ghosted_applications() -> (
    None
):
    ghosted = history_frame((*HISTORY, *OLD_GHOSTS))

    assert stage_pass_counts(rows_of(ghosted)) == stage_pass_counts(
        rows_of(history_frame())
    )
    assert body_of(ghosted) == FORECAST_BODY | {"applications": 31}


def test_keeps_in_flight_the_applications_open_at_an_active_stage() -> None:
    flying = in_flight(clean_events(history_frame()), now=FORECAST_NOW)

    assert sorted(zip(flying.stages, flying.elapsed_days, strict=True)) == [
        (0, 2.0),
        (0, 4.0),
        (0, 7.0),
        (0, 10.0),
        (1, 8.125),
        (2, 9.0),
    ]


@pytest.mark.parametrize(
    ("starts", "now", "expected"),
    [
        ((0, 10, 50, 60, 65), day(70), 0.75),
        ((0, 3, 7), day(14), 1.5),
        ((13,), day(14), 1.0),
    ],
    ids=["older than four weeks", "two weeks young", "a day young"],
)
def test_counts_only_the_applications_of_the_last_four_weeks_in_the_rate(
    starts: tuple[float, ...], *, now: datetime, expected: float
) -> None:
    rows = rows_of(history_frame(((OPEN_AT_APPLIED, starts),)))

    assert applications_per_week(rows, now=now) == expected


def test_answers_insufficient_data_below_fifteen_applications_and_a_forecast_at_fifteen() -> (
    None
):
    below = body_of(history_frame(((REJECTED_AT_APPLIED, tuple(range(14))),)))
    at = body_of(history_frame(((REJECTED_AT_APPLIED, tuple(range(15))),)))

    assert below == {
        "status": "insufficient_data",
        "have": 14,
        "need": 1,
        "message": "Ще 1 відгук до першого висновку",
    }
    assert at["status"] == "ok"


def test_waits_for_the_first_company_reply_before_a_forecast() -> None:
    silent = history_frame(((OPEN_AT_APPLIED, tuple(range(15))),))

    assert forecast(silent, now=FORECAST_NOW, what_if=WhatIf()) == Insufficient(
        have=0, need=1, message="Прогноз з'явиться після першої відповіді компанії"
    )


def test_forecasts_the_fixture_history_to_the_literal_body_on_every_call() -> None:
    assert [body_of(history_frame()) for _ in range(2)] == [FORECAST_BODY] * 2


def test_keeps_the_median_within_a_tenth_of_a_week_across_seeds() -> None:
    baseline = body_of(history_frame())["medianWeeks"]
    medians = [
        ok_forecast(seed=seed, what_if=WhatIf()).median_weeks for seed in range(1, 6)
    ]

    assert all(
        median is not None and abs(median - baseline) <= 0.1 for median in medians
    ), medians


def test_moves_the_median_earlier_and_narrows_the_corridor_when_tech_conversion_reaches_sixty_percent() -> (
    None
):
    now = body_of(history_frame())
    improved = body_of(history_frame(), improve=Improvement("tech_interview", 0.6))

    assert improved["medianWeeks"] < now["medianWeeks"]
    assert (
        improved["likely"]["high"] - improved["likely"]["low"]
        < now["likely"]["high"] - now["likely"]["low"]
    )


def test_reports_the_what_if_rate_instead_of_the_observed_one() -> None:
    assert (
        body_of(history_frame(), applications_per_week=6.0)["applicationsPerWeek"]
        == 6.0
    )


def test_forecasts_sixty_applications_at_fifty_a_week_within_300_ms() -> None:
    events = history_frame(SIXTY_APPLICATIONS)
    timings = []
    for _ in range(3):
        started = time.perf_counter()
        forecast(events, now=FORECAST_NOW, what_if=WhatIf(applications_per_week=50))
        timings.append(time.perf_counter() - started)

    assert min(timings) < LIMIT_SECONDS
