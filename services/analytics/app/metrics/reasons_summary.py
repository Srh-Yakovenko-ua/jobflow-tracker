import pandas as pd

from app.metrics.data_rules import clean_events
from app.metrics.rate import MetricModel
from app.metrics.reason_tallies import ReasonCount, stage_rejections, tallies


class ReasonsSummary(MetricModel):
    stage: str
    total: int
    reasons: list[ReasonCount]


def reasons_summary(events: pd.DataFrame, *, stage: str) -> ReasonsSummary:
    codes = stage_rejections(clean_events(events), stage=stage)
    return ReasonsSummary(stage=stage, total=len(codes), reasons=tallies(codes))
