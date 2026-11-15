import math
from datetime import datetime
from typing import Final

import pandas as pd

from app.core.enums import load_domain_enums
from app.metrics.rate import MetricModel

MIN_SALARY_REJECTIONS: Final = 2
FLOOR_STEP_USD: Final = 500
DAYS_IN_MONTH: Final = 30


class SalaryFloor(MetricModel):
    floor: int
    rejections: int
    below: int
    per_month_low: int
    per_month_high: int


def months_since_first_event(clean: pd.DataFrame, *, now: datetime) -> float:
    days = float((now - clean["occurred_at"].min()).total_seconds()) / 86400
    return max(1.0, days / DAYS_IN_MONTH)


def salary_floor(
    rows: pd.DataFrame, *, clean: pd.DataFrame, now: datetime
) -> SalaryFloor | None:
    in_scope = clean["application_id"].nunique()
    if in_scope < load_domain_enums().thresholds.min_n_insight:
        return None
    rejected = rows.loc[rows["outcome"] == "salary_rejection", "high_usd"]
    if len(rejected) < MIN_SALARY_REJECTIONS:
        return None
    floor = (int(rejected.max()) // FLOOR_STEP_USD + 1) * FLOOR_STEP_USD
    if (rows.loc[rows["outcome"] == "offer", "high_usd"] < floor).any():
        return None
    below = int((rows["high_usd"] < floor).sum())
    per_month = below / months_since_first_event(clean, now=now)
    return SalaryFloor(
        floor=floor,
        rejections=len(rejected),
        below=below,
        per_month_low=max(1, math.floor(per_month)),
        per_month_high=max(1, math.ceil(per_month)),
    )
