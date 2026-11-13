from datetime import datetime, timedelta
from typing import Annotated, Literal

import pandas as pd
from pydantic import Field

from app.core.enums import load_domain_enums
from app.metrics.rate import Insufficient, MetricModel, insufficient
from app.metrics.reason_tallies import leading, tallies

TREND_WINDOW = timedelta(days=30)


class TopReason(MetricModel):
    status: Literal["ok"] = "ok"
    stage: str
    code: str
    count: int
    of: int


type TopReasonResult = Annotated[
    TopReason | Insufficient, Field(discriminator="status")
]


class ReasonsTrend(MetricModel):
    previous: str | None
    changed: bool


def top_reason(
    stated: pd.Series[str], *, stage: str, applications: int
) -> TopReason | Insufficient | None:
    threshold = load_domain_enums().thresholds.min_n_insight
    short = insufficient(applications, threshold=threshold)
    if short is not None:
        return short
    lead = leading(tallies(stated))
    if lead is None:
        return None
    return TopReason(stage=stage, code=lead.code, count=lead.count, of=len(stated))


def reasons_trend(
    stated: pd.Series[str], *, top: TopReason | Insufficient | None, now: datetime
) -> ReasonsTrend | None:
    if not isinstance(top, TopReason):
        return None
    lead = leading(tallies(stated[stated.index < now - TREND_WINDOW]))
    previous = None if lead is None else lead.code
    return ReasonsTrend(
        previous=previous, changed=previous is not None and previous != top.code
    )


def headline(
    tops: list[TopReason | Insufficient | None],
) -> TopReason | Insufficient | None:
    short = next((top for top in tops if isinstance(top, Insufficient)), None)
    if short is not None:
        return short
    order = load_domain_enums().stages
    return max(
        (top for top in tops if isinstance(top, TopReason)),
        key=lambda top: (top.count, top.count / top.of, order.index(top.stage)),
        default=None,
    )
