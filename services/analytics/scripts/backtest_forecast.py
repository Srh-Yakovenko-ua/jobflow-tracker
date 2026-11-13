from datetime import UTC, datetime, timedelta
from math import inf
from statistics import fmean, median
from typing import Final, NamedTuple
from uuid import UUID

import numpy as np
import pandas as pd
from loguru import logger
from pydantic import BaseModel, ConfigDict

from app.core.enums import OFFER_STAGE, REJECTED_STAGE, progress_stages
from app.metrics.forecast import Forecast, WhatIf, forecast
from app.metrics.offer_simulation import HORIZON_WEEKS

CONVERSIONS: Final = (0.45, 0.5, 0.45, 0.6)
MEAN_STAY_DAYS: Final = (6.0, 8.0, 9.0, 14.0)
STAY_SHAPE: Final = 2.0
APPLICATIONS_PER_WEEK: Final = 4.5
CUT: Final = timedelta(weeks=4)
HISTORY: Final = CUT + timedelta(weeks=HORIZON_WEEKS)
START: Final = datetime(2026, 1, 5, 9, tzinfo=UTC)
BACKTEST_SEED: Final = 4
BACKTEST_USERS: Final = 200
WEEK: Final = pd.Timedelta(weeks=1)

type Move = tuple[str, float]


class BacktestReport(BaseModel):
    model_config = ConfigDict(frozen=True)

    users: int
    forecasted: int
    interval_coverage: float
    median_absolute_error_weeks: float
    observed_within_four_weeks: float
    predicted_within_four_weeks: float
    observed_within_eight_weeks: float
    predicted_within_eight_weeks: float


class Outcome(NamedTuple):
    result: Forecast
    actual_weeks: float


def journey(rng: np.random.Generator, *, start: float) -> list[Move]:
    stages = progress_stages()
    moves = [(stages[0], start)]
    moment = start
    for index, conversion in enumerate(CONVERSIONS):
        moment += rng.gamma(STAY_SHAPE, MEAN_STAY_DAYS[index] / STAY_SHAPE)
        if rng.random() >= conversion:
            return [*moves, (REJECTED_STAGE, moment)]
        moves.append((stages[index + 1], moment))
    return moves


def user_events(rng: np.random.Generator, *, user: int) -> pd.DataFrame:
    days = HISTORY / timedelta(days=1)
    count = rng.poisson(APPLICATIONS_PER_WEEK * days / 7)
    starts = np.sort(rng.uniform(0, days, count))
    records = [
        {
            "id": UUID(int=(user << 64) + (application << 8) + order),
            "application_id": UUID(int=(user << 64) + (application << 8)),
            "compensates_event_id": None,
            "to_stage": stage,
            "occurred_at": START + timedelta(days=moment),
        }
        for application, start in enumerate(starts)
        for order, (stage, moment) in enumerate(journey(rng, start=float(start)))
    ]
    return pd.DataFrame.from_records(records)


def first_offer_after(events: pd.DataFrame, *, cut: datetime) -> float:
    later = events[(events["to_stage"] == OFFER_STAGE) & (events["occurred_at"] >= cut)]
    if later.empty:
        return inf
    weeks = float((later["occurred_at"].min() - cut) / WEEK)
    return weeks if weeks <= HORIZON_WEEKS else inf


def backtest_user(rng: np.random.Generator, *, user: int) -> Outcome | None:
    events = user_events(rng, user=user)
    cut = START + CUT
    result = forecast(events[events["occurred_at"] < cut], now=cut, what_if=WhatIf())
    if not isinstance(result, Forecast):
        return None
    return Outcome(result, first_offer_after(events, cut=cut))


def weeks_or_inf(weeks: float | None) -> float:
    return inf if weeks is None else weeks


def covered(outcome: Outcome) -> bool:
    interval = outcome.result.interval
    low, high = weeks_or_inf(interval.low), weeks_or_inf(interval.high)
    return low <= outcome.actual_weeks <= high


def share(flags: list[bool]) -> float:
    return round(sum(flags) / len(flags), 4)


def report_of(outcomes: list[Outcome], *, users: int) -> BacktestReport:
    actual = [outcome.actual_weeks for outcome in outcomes]
    errors = [
        abs(weeks - outcome.result.median_weeks)
        for outcome, weeks in zip(outcomes, actual, strict=True)
        if outcome.result.median_weeks is not None and weeks != inf
    ]
    return BacktestReport(
        users=users,
        forecasted=len(outcomes),
        interval_coverage=share([covered(outcome) for outcome in outcomes]),
        median_absolute_error_weeks=round(median(errors), 2),
        observed_within_four_weeks=share([weeks <= 4 for weeks in actual]),
        predicted_within_four_weeks=round(
            fmean(outcome.result.within_four_weeks for outcome in outcomes), 4
        ),
        observed_within_eight_weeks=share([weeks <= 8 for weeks in actual]),
        predicted_within_eight_weeks=round(
            fmean(outcome.result.within_eight_weeks for outcome in outcomes), 4
        ),
    )


def run_backtest(*, users: int, seed: int = BACKTEST_SEED) -> BacktestReport:
    rng = np.random.default_rng(seed)
    outcomes = [backtest_user(rng, user=user) for user in range(users)]
    kept = [outcome for outcome in outcomes if outcome is not None]
    return report_of(kept, users=users)


def main() -> None:
    report = run_backtest(users=BACKTEST_USERS)
    for name, value in report.model_dump().items():
        logger.info("{name}: {value}", name=name, value=value)


if __name__ == "__main__":
    main()
