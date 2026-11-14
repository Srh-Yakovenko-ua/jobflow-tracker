from datetime import date, datetime

import pandas as pd

from app.core.enums import GHOSTED_STAGE, progress_stages, stages_with_role
from app.metrics.data_rules import clean_events
from app.metrics.journeys import ended_at, journeys, reached
from app.metrics.kpis import FunnelKpis, SearchPeriod, kpis
from app.metrics.most_expensive import MostExpensiveResult, most_expensive
from app.metrics.rate import MetricModel, RateResult, rate


class FunnelStage(MetricModel):
    stage: str
    reached: int
    passed: int | None
    conversion: RateResult | None
    drop_off: dict[str, int]


class Funnel(MetricModel):
    stages: list[FunnelStage]
    kpis: FunnelKpis
    most_expensive: MostExpensiveResult | None


def funnel_stage(rows: pd.DataFrame, *, index: int) -> FunnelStage:
    stages = progress_stages()
    ended = ended_at(rows, index=index)["outcome"]
    drop_off = {
        outcome: int((ended == outcome).sum())
        for outcome in stages_with_role("outcome")
    }
    count = reached(rows, index=index)
    is_last = index == len(stages) - 1
    passed = None if is_last else reached(rows, index=index + 1)
    conversion = (
        None if passed is None else rate(passed, count - drop_off[GHOSTED_STAGE])
    )
    return FunnelStage(
        stage=stages[index],
        reached=count,
        passed=passed,
        conversion=conversion,
        drop_off=drop_off,
    )


def funnel_stages(rows: pd.DataFrame) -> list[FunnelStage]:
    return [funnel_stage(rows, index=index) for index in range(len(progress_stages()))]


def funnel(
    events: pd.DataFrame,
    *,
    period: SearchPeriod,
    now: datetime,
    month: date | None = None,
) -> Funnel:
    rows = journeys(clean_events(events))
    return Funnel(
        stages=funnel_stages(rows),
        kpis=kpis(rows, period=period, now=now, month=month),
        most_expensive=most_expensive(rows),
    )
