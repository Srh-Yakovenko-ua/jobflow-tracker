from math import floor
from typing import Annotated, Literal

import pandas as pd
from pydantic import Field

from app.core.enums import GHOSTED_STAGE, load_domain_enums
from app.metrics.rate import Insufficient, MetricModel, percent_shortfall


class StageTiming(MetricModel):
    status: Literal["ok"] = "ok"
    stage: str
    median_days: float
    lower_quartile_days: float
    upper_quartile_days: float
    samples: int


class StageShortfall(Insufficient):
    stage: str


type StageTimingResult = Annotated[
    StageTiming | StageShortfall, Field(discriminator="status")
]


def whole_days(days: float) -> int:
    return floor(days + 0.5)


def stage_stays(clean: pd.DataFrame) -> pd.DataFrame:
    moments = pd.to_datetime(clean["occurred_at"], utc=True)
    later = clean.assign(occurred_at=moments).groupby("application_id")
    next_stage = later["to_stage"].shift(-1)
    lasted = (later["occurred_at"].shift(-1) - moments) / pd.Timedelta(days=1)
    kept = (
        clean["to_stage"].isin(load_domain_enums().active_stages)
        & next_stage.notna()
        & (next_stage != GHOSTED_STAGE)
    )
    return pd.DataFrame(
        {"stage": clean.loc[kept, "to_stage"], "days": lasted[kept]}
    ).reset_index(drop=True)


def stage_timing(days: pd.Series[float], *, stage: str) -> StageTimingResult:
    short = percent_shortfall(len(days))
    if short is not None:
        return StageShortfall(stage=stage, **short.model_dump())
    return StageTiming(
        stage=stage,
        median_days=float(days.median()),
        lower_quartile_days=float(days.quantile(0.25)),
        upper_quartile_days=float(days.quantile(0.75)),
        samples=len(days),
    )


def stage_timings(stays: pd.DataFrame) -> list[StageTimingResult]:
    return [
        stage_timing(stays.loc[stays["stage"] == stage, "days"], stage=stage)
        for stage in load_domain_enums().active_stages
    ]


def stage_norms(stays: pd.DataFrame) -> dict[str, int | None]:
    return {
        timing.stage: (
            whole_days(timing.median_days) if isinstance(timing, StageTiming) else None
        )
        for timing in stage_timings(stays)
    }
