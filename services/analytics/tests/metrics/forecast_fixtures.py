from typing import Any

import pandas as pd

from tests.factories import day
from tests.metrics.sankey_fixtures import DatedMove, dated_frame

type Stops = tuple[tuple[str, float], ...]

FORECAST_NOW = day(70)

OFFERED: Stops = (
    ("applied", 0),
    ("screening", 5),
    ("tech_interview", 12),
    ("final", 20),
    ("offer", 34),
)
REJECTED_AT_FINAL: Stops = (
    ("applied", 0),
    ("screening", 5),
    ("tech_interview", 11),
    ("final", 19),
    ("rejected", 27),
)
REJECTED_AT_TECH: Stops = (
    ("applied", 0),
    ("screening", 4),
    ("tech_interview", 10),
    ("rejected", 18),
)
REJECTED_AT_SCREENING: Stops = (("applied", 0), ("screening", 6), ("rejected", 10))
REJECTED_AT_APPLIED: Stops = (("applied", 0), ("rejected", 7))
WITHDRAWN_AT_SCREENING: Stops = (("applied", 0), ("screening", 3), ("withdrawn", 8))
GHOSTED_AT_APPLIED: Stops = (("applied", 0), ("ghosted", 21))
OPEN_AT_APPLIED: Stops = (("applied", 0),)
OPEN_AT_SCREENING: Stops = (("applied", 0), ("screening", 5))
OPEN_AT_TECH: Stops = (("applied", 0), ("screening", 4), ("tech_interview", 9))

type Cohort = tuple[Stops, tuple[float, ...]]

HISTORY: tuple[Cohort, ...] = (
    (OFFERED, (0, 9)),
    (REJECTED_AT_SCREENING, (1, 8, 15, 22, 30, 38)),
    (REJECTED_AT_APPLIED, (2, 12, 26, 41, 50)),
    (REJECTED_AT_TECH, (5, 19, 33)),
    (REJECTED_AT_FINAL, (14,)),
    (GHOSTED_AT_APPLIED, (3, 17, 29, 44)),
    (WITHDRAWN_AT_SCREENING, (24,)),
    (OPEN_AT_APPLIED, (60, 63, 66, 68)),
    (OPEN_AT_SCREENING, (55,)),
    (OPEN_AT_TECH, (52,)),
)
OLD_GHOSTS: tuple[Cohort, ...] = ((GHOSTED_AT_APPLIED, (20, 20, 20)),)

FORECAST_BODY: dict[str, Any] = {
    "status": "ok",
    "medianWeeks": 4.39,
    "likely": {"low": 2.29, "high": 8.56},
    "interval": {"low": 2.0, "high": 16.82},
    "withinFourWeeks": 0.4448,
    "withinEightWeeks": 0.7323,
    "applicationsPerWeek": 2.0,
    "applications": 28,
    "offers": 2,
    "horizonWeeks": 52,
}


def started(stops: Stops, *, on: float) -> list[DatedMove]:
    stretch = 1 + on % 4 / 8
    return [(stage, None, on + offset * stretch) for stage, offset in stops]


def history_frame(cohorts: tuple[Cohort, ...] = HISTORY) -> pd.DataFrame:
    return dated_frame(
        [started(stops, on=start) for stops, starts in cohorts for start in starts]
    )
