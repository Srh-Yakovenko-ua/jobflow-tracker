from datetime import timedelta

import pandas as pd

from tests.factories import EVENTS_BASE_TIME, application
from tests.metrics.funnel_design import TECH_INTERVIEW
from tests.metrics.sankey_fixtures import (
    APPLIED,
    SCREENING,
    Journey,
    cohort,
    reasoned_frame,
    rejected_at,
)

DESIGN_NOW = EVENTS_BASE_TIME + timedelta(days=11)
WAITING_AT_SCREENING = 5


def design_journeys(*, ghosted: int = 3) -> list[Journey]:
    return [
        *rejected_at(TECH_INTERVIEW, reason="skills_gap", count=3),
        *rejected_at(TECH_INTERVIEW, reason="english_level", count=1),
        *cohort(SCREENING, end=("rejected", None), count=1),
        *cohort(APPLIED, end=("screening", None), count=4),
        *cohort(APPLIED, end=("ghosted", None), count=ghosted),
    ]


def design_frame(*, ghosted: int = 3) -> pd.DataFrame:
    return reasoned_frame(design_journeys(ghosted=ghosted))


def aged(frame: pd.DataFrame, *, first: int, days: int) -> pd.DataFrame:
    older = frame["application_id"].isin([application(index) for index in range(first)])
    moved = frame["occurred_at"] - timedelta(days=days)
    return frame.assign(occurred_at=frame["occurred_at"].mask(older, moved))
