from typing import NamedTuple

import pandas as pd

from app.core.enums import GROSS_SALARY, load_domain_enums


class SalaryPoints(NamedTuple):
    points: pd.DataFrame
    missing: int
    unconverted: int


def amount(salaries: pd.DataFrame, *, side: str, other: str) -> pd.Series:
    return salaries[side].astype(float).fillna(salaries[other].astype(float))


def usd_factor(salaries: pd.DataFrame) -> pd.Series:
    rules = load_domain_enums().salary
    per_usd = salaries["currency"].map(dict(rules.per_usd)).astype(float)
    gross = salaries["salary_tax"] == GROSS_SALARY
    return gross.map({True: rules.net_share_of_gross, False: 1.0}) / per_usd


def salary_points(salaries: pd.DataFrame) -> SalaryPoints:
    low = amount(salaries, side="salary_min", other="salary_max")
    high = amount(salaries, side="salary_max", other="salary_min")
    factor = usd_factor(salaries)
    stated = low.notna()
    converted = stated & factor.notna()
    points = pd.DataFrame(
        {
            "low_usd": low * factor,
            "high_usd": high * factor,
            "point_usd": (low + high) / 2 * factor,
            "stack": salaries["stack"],
            "seniority": salaries["seniority"],
        }
    )[converted]
    return SalaryPoints(
        points=points.set_axis(salaries.loc[converted, "application_id"]),
        missing=int((~stated).sum()),
        unconverted=int((stated & ~converted).sum()),
    )
