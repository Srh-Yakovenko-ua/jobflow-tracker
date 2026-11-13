from typing import Annotated, Literal

import pandas as pd
from pydantic import Field

from app.core.enums import load_domain_enums, progress_stages
from app.metrics.journeys import ended_at, reached
from app.metrics.rate import Insufficient, MetricModel, insufficient


class MostExpensiveStage(MetricModel):
    status: Literal["ok"] = "ok"
    stage: str
    reached: int
    passed: int
    lost: int
    invested_days_median: float


type MostExpensiveResult = Annotated[
    MostExpensiveStage | Insufficient, Field(discriminator="status")
]


def invested_days(rows: pd.DataFrame, *, index: int) -> pd.Series[float]:
    lost = ended_at(rows, index=index)
    spent: pd.Series[pd.Timedelta] = lost[progress_stages()[index]] - lost["started_at"]
    return spent / pd.Timedelta(days=1)


def most_expensive(rows: pd.DataFrame) -> MostExpensiveStage | Insufficient | None:
    threshold = load_domain_enums().thresholds.min_n_insight
    short = insufficient(len(rows), threshold=threshold)
    if short is not None:
        return short
    stages = progress_stages()
    losses = {
        index: days
        for index in range(len(stages) - 1)
        if len(days := invested_days(rows, index=index))
    }
    if not losses:
        return None
    index = max(losses, key=lambda index: (losses[index].sum(), index))
    return MostExpensiveStage(
        stage=stages[index],
        reached=reached(rows, index=index),
        passed=reached(rows, index=index + 1),
        lost=len(losses[index]),
        invested_days_median=float(losses[index].median()),
    )
