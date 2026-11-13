from datetime import datetime

import pandas as pd

from app.core.enums import rejectable_stages
from app.metrics.data_rules import clean_events
from app.metrics.rate import MetricModel, RateResult, rate
from app.metrics.reason_tallies import (
    ReasonCount,
    side_of,
    stage_rejections,
    stated_sides,
    tallies,
)
from app.metrics.reasons_trend import (
    ReasonsTrend,
    TopReasonResult,
    headline,
    reasons_trend,
    top_reason,
)


class ReasonShare(ReasonCount):
    share: RateResult


class SideShare(MetricModel):
    count: int
    share: RateResult


class StageReasons(MetricModel):
    stage: str
    total: int
    stated: int
    sides: dict[str, SideShare]
    reasons: list[ReasonShare]
    unstated: list[ReasonCount]
    top: TopReasonResult | None
    trend: ReasonsTrend | None


class Reasons(MetricModel):
    stages: list[StageReasons]
    headline: TopReasonResult | None


def side_shares(stated: list[ReasonCount]) -> dict[str, SideShare]:
    sides = side_of()
    trials = sum(reason.count for reason in stated)
    counts = {
        side: sum(reason.count for reason in stated if sides[reason.code] == side)
        for side in stated_sides()
    }
    return {
        side: SideShare(count=count, share=rate(count, trials))
        for side, count in counts.items()
    }


def stage_reasons(
    codes: pd.Series[str], *, stage: str, applications: int, now: datetime
) -> StageReasons:
    sides = side_of()
    counted = tallies(codes)
    stated = [reason for reason in counted if sides[reason.code] in stated_sides()]
    stated_codes = codes[codes.map(sides).isin(stated_sides())]
    top = top_reason(stated_codes, stage=stage, applications=applications)
    return StageReasons(
        stage=stage,
        total=len(codes),
        stated=len(stated_codes),
        sides=side_shares(stated),
        reasons=[
            ReasonShare(
                code=reason.code,
                count=reason.count,
                share=rate(reason.count, len(stated_codes)),
            )
            for reason in stated
        ],
        unstated=[reason for reason in counted if reason not in stated],
        top=top,
        trend=reasons_trend(stated_codes, top=top, now=now),
    )


def reasons(events: pd.DataFrame, *, stage: str | None, now: datetime) -> Reasons:
    clean = clean_events(events)
    applications = clean["application_id"].nunique()
    listed = [
        stage_reasons(
            stage_rejections(clean, stage=listed_stage),
            stage=listed_stage,
            applications=applications,
            now=now,
        )
        for listed_stage in (rejectable_stages() if stage is None else (stage,))
    ]
    return Reasons(stages=listed, headline=headline([item.top for item in listed]))
