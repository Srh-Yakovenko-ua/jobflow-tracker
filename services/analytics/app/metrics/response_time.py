from statistics import median
from typing import Annotated, Literal

import pandas as pd
from pydantic import Field

from app.core.enums import CANDIDATE_SIDE, load_domain_enums
from app.metrics.rate import Insufficient, MetricModel, percent_shortfall
from app.metrics.reason_tallies import side_of


class ResponseTime(MetricModel):
    status: Literal["ok"] = "ok"
    days: float
    samples: int


class ResponseHours(MetricModel):
    status: Literal["ok"] = "ok"
    hours: float
    samples: int


type ResponseHoursResult = Annotated[
    ResponseHours | Insufficient, Field(discriminator="status")
]


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
    short = percent_shortfall(len(days))
    return short or ResponseTime(days=float(days.median()), samples=len(days))


def wait_steps(clean: pd.DataFrame, *, followups: pd.DataFrame) -> pd.DataFrame:
    later = clean.groupby("application_id").cumcount() > 0
    declined = clean["reason_code"].map(side_of()) == CANDIDATE_SIDE
    replied = clean["to_stage"].isin(load_domain_enums().reply_stages)
    moves = pd.DataFrame(
        {
            "application_id": clean["application_id"],
            "at": pd.to_datetime(clean["occurred_at"], utc=True),
            "starts": ~later,
            "replies": later & replied & ~declined,
            "order": 0,
        }
    )
    sent = pd.DataFrame(
        {
            "application_id": followups["application_id"],
            "at": pd.to_datetime(followups["occurred_at"], utc=True),
            "starts": True,
            "replies": False,
            "order": 1,
        }
    )
    steps = pd.concat([moves, sent], ignore_index=True)
    return steps.sort_values(["at", "order"], kind="stable")


def reply_hours(steps: pd.DataFrame) -> list[float]:
    hours: list[float] = []
    waiting_since: pd.Timestamp | None = None
    for at, starts, replies in steps[["at", "starts", "replies"]].itertuples(
        index=False
    ):
        if replies and waiting_since is not None:
            hours.append((at - waiting_since) / pd.Timedelta(hours=1))
            waiting_since = None
        if starts:
            waiting_since = at
    return hours


def response_hours(clean: pd.DataFrame, *, followups: pd.DataFrame) -> list[float]:
    steps = wait_steps(clean, followups=followups)
    return [
        sample
        for _, waits in steps.groupby("application_id")
        for sample in reply_hours(waits)
    ]


def median_response_hours(hours: list[float]) -> ResponseHours | Insufficient:
    short = percent_shortfall(len(hours))
    return short or ResponseHours(hours=median(hours), samples=len(hours))
