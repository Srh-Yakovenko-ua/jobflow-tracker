import pandas as pd

from app.metrics.data_rules import clean_events
from app.metrics.days_to_offer import days_to_offer
from app.metrics.ghost_market import GhostRateVsMarket, ghost_rate_vs_market
from app.metrics.rate import MetricModel
from app.metrics.response_time import (
    ResponseHoursResult,
    ResponseTimeResult,
    median_response,
    median_response_hours,
    response_hours,
)
from app.metrics.stage_timing import StageTimingResult, stage_stays, stage_timings


class Timings(MetricModel):
    stages: list[StageTimingResult]
    response_time: ResponseHoursResult
    median_days_to_offer: ResponseTimeResult
    ghost_rate: GhostRateVsMarket


def timings(events: pd.DataFrame, *, followups: pd.DataFrame) -> Timings:
    clean = clean_events(events)
    return Timings(
        stages=stage_timings(stage_stays(clean)),
        response_time=median_response_hours(response_hours(clean, followups=followups)),
        median_days_to_offer=median_response(days_to_offer(clean)),
        ghost_rate=ghost_rate_vs_market(events),
    )
