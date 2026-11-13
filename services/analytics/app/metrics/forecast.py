from datetime import datetime
from math import isinf
from typing import Annotated, Final, Literal, NamedTuple

import numpy as np
import pandas as pd
from pydantic import Field

from app.core.enums import load_domain_enums
from app.metrics.data_rules import clean_events
from app.metrics.forecast_inputs import (
    applications_per_week,
    in_flight,
    stage_pass_counts,
    stay_pools,
)
from app.metrics.journeys import journeys, reached
from app.metrics.offer_simulation import (
    HORIZON_WEEKS,
    Improvement,
    Pipeline,
    Weeks,
    first_offer_weeks,
)
from app.metrics.rate import Insufficient, MetricModel, insufficient
from app.metrics.stage_timing import stage_stays

FORECAST_SEED: Final = 2026
NO_REPLY: Final = Insufficient(
    have=0, need=1, message="Прогноз з'явиться після першої відповіді компанії"
)


class WeeksRange(MetricModel):
    low: float | None
    high: float | None


class Forecast(MetricModel):
    status: Literal["ok"] = "ok"
    median_weeks: float | None
    likely: WeeksRange
    interval: WeeksRange
    within_four_weeks: float
    within_eight_weeks: float
    applications_per_week: float
    applications: int
    offers: int
    horizon_weeks: int = HORIZON_WEEKS


ForecastResult = Annotated[Forecast | Insufficient, Field(discriminator="status")]


class WhatIf(NamedTuple):
    applications_per_week: float | None = None
    improve: Improvement | None = None


def weeks_at(times: Weeks, *, share: float) -> float | None:
    value = float(np.quantile(times, share, method="inverted_cdf"))
    return None if isinf(value) else round(value, 2)


def weeks_range(times: Weeks, *, low: float, high: float) -> WeeksRange:
    return WeeksRange(low=weeks_at(times, share=low), high=weeks_at(times, share=high))


def forecast(
    events: pd.DataFrame, *, now: datetime, what_if: WhatIf, seed: int = FORECAST_SEED
) -> Forecast | Insufficient:
    clean = clean_events(events)
    applications = int(clean["application_id"].nunique())
    threshold = load_domain_enums().thresholds.min_n_forecast
    short = insufficient(applications, threshold=threshold)
    if short is not None:
        return short
    stays = stage_stays(clean)
    if stays.empty:
        return NO_REPLY
    rows = journeys(clean)
    rate = what_if.applications_per_week
    pipeline = Pipeline(
        passes=stage_pass_counts(rows),
        stays=stay_pools(stays),
        in_flight=in_flight(clean, now=now),
        rate=applications_per_week(rows, now=now) if rate is None else rate,
        improve=what_if.improve,
    )
    times = first_offer_weeks(pipeline, seed=seed)
    return Forecast(
        median_weeks=weeks_at(times, share=0.5),
        likely=weeks_range(times, low=0.25, high=0.75),
        interval=weeks_range(times, low=0.1, high=0.9),
        within_four_weeks=float(np.mean(times <= 4)),
        within_eight_weeks=float(np.mean(times <= 8)),
        applications_per_week=round(pipeline.rate, 2),
        applications=applications,
        offers=reached(rows, index=len(pipeline.passes.successes)),
    )
