from typing import Annotated, Literal

import pandas as pd
from pydantic import Field

from app.core.enums import CANDIDATE_SIDE, load_domain_enums
from app.metrics.rate import Insufficient, MetricModel, insufficient
from app.metrics.reason_tallies import side_of


class ResponseTime(MetricModel):
    status: Literal["ok"] = "ok"
    days: float
    samples: int


type ResponseTimeResult = Annotated[
    ResponseTime | Insufficient, Field(discriminator="status")
]


def response_days(clean: pd.DataFrame, *, started_at: pd.Series) -> pd.Series[float]:
    later = clean[clean.groupby("application_id").cumcount() > 0]
    declined = later["reason_code"].map(side_of()) == CANDIDATE_SIDE
    is_reply = later["to_stage"].isin(load_domain_enums().response_stages)
    replies = later[is_reply & ~declined]
    replied_at = pd.to_datetime(
        replies.groupby("application_id")["occurred_at"].min(), utc=True
    )
    waited: pd.Series[pd.Timedelta] = replied_at - started_at.reindex(replied_at.index)
    return waited / pd.Timedelta(days=1)


def median_response(days: pd.Series[float]) -> ResponseTime | Insufficient:
    threshold = load_domain_enums().thresholds.min_n_percent
    short = insufficient(len(days), threshold=threshold)
    if short is not None:
        return short
    return ResponseTime(days=float(days.median()), samples=len(days))
