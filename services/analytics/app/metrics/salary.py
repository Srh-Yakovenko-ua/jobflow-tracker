from collections.abc import Iterable
from datetime import datetime
from typing import Final, Literal, get_args

import numpy as np
import pandas as pd

from app.core.enums import OFFER_STAGE, load_domain_enums
from app.metrics.data_rules import clean_events
from app.metrics.rate import MetricModel
from app.metrics.salary_floor import SalaryFloor, salary_floor
from app.metrics.salary_points import salary_points

type SalaryOutcome = Literal["offer", "salary_rejection", "other"]

SALARY_OUTCOMES: Final[tuple[SalaryOutcome, ...]] = get_args(SalaryOutcome.__value__)
TOP_STACK: Final = 5


class SalaryRange(MetricModel):
    applications: int
    low: int
    median: int
    high: int


class OutcomeRange(SalaryRange):
    key: SalaryOutcome


class SalaryGroup(SalaryRange):
    key: str


class Salary(MetricModel):
    with_salary: int
    missing: int
    unconverted: int
    median: int | None
    outcomes: list[OutcomeRange]
    seniority: list[SalaryGroup]
    stack: list[SalaryGroup]
    floor: SalaryFloor | None


def outcomes_of(clean: pd.DataFrame) -> pd.Series:
    last = clean.groupby("application_id").tail(1).set_index("application_id")
    offered = clean.loc[clean["to_stage"] == OFFER_STAGE, "application_id"]
    reasons = load_domain_enums().salary.reason_codes
    chosen = np.select(
        [last["reason_code"].isin(reasons), last.index.isin(offered)],
        ["salary_rejection", "offer"],
        default="other",
    )
    return pd.Series(chosen, index=last.index, dtype=object)


def range_fields(rows: pd.DataFrame) -> dict[str, int]:
    return {
        "applications": len(rows),
        "low": round(rows["low_usd"].min()),
        "median": round(rows["point_usd"].median()),
        "high": round(rows["high_usd"].max()),
    }


def keyed_ranges[Group: SalaryRange](
    rows: pd.DataFrame, *, by: str, keys: Iterable[str], group: type[Group]
) -> list[Group]:
    return [
        group.model_validate({"key": key, **range_fields(rows[rows[by] == key])})
        for key in keys
        if (rows[by] == key).any()
    ]


def top_stack(rows: pd.DataFrame) -> list[SalaryGroup]:
    items = rows.explode("stack")
    counts = items["stack"].value_counts()
    ranked = sorted(counts.index, key=lambda key: (-counts[key], key))[:TOP_STACK]
    return keyed_ranges(items, by="stack", keys=ranked, group=SalaryGroup)


def salary(events: pd.DataFrame, *, salaries: pd.DataFrame, now: datetime) -> Salary:
    clean = clean_events(events)
    found = salary_points(salaries)
    outcome = outcomes_of(clean).reindex(found.points.index).fillna("other")
    rows = found.points.assign(outcome=outcome)
    median = rows["point_usd"].median()
    return Salary(
        with_salary=len(rows),
        missing=found.missing,
        unconverted=found.unconverted,
        median=None if rows.empty else round(median),
        outcomes=keyed_ranges(
            rows, by="outcome", keys=SALARY_OUTCOMES, group=OutcomeRange
        ),
        seniority=keyed_ranges(
            rows,
            by="seniority",
            keys=load_domain_enums().seniorities,
            group=SalaryGroup,
        ),
        stack=top_stack(rows),
        floor=salary_floor(rows, clean=clean, now=now),
    )
