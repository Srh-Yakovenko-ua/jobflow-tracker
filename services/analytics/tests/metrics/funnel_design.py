from datetime import datetime, timedelta

import pandas as pd

from app.metrics.kpis import SearchPeriod
from tests.factories import TimedMove, timed_frame

type DesignFlow = tuple[tuple[str, ...], str, int, str]

ENTRY_DAYS = {"applied": 0, "screening": 6, "tech_interview": 17, "final": 26}
OUTCOME_LAG_DAYS = 2
SENT_AT = "T09:00Z"

APPLIED = ("applied",)
SCREENING = (*APPLIED, "screening")
TECH_INTERVIEW = (*SCREENING, "tech_interview")
FINAL = (*TECH_INTERVIEW, "final")

DESIGN_FLOWS: list[DesignFlow] = [
    (APPLIED, "rejected", 2, "2026-06-05"),
    (APPLIED, "ghosted", 7, "2026-06-06"),
    (TECH_INTERVIEW, "ghosted", 1, "2026-06-08"),
    (SCREENING, "rejected", 5, "2026-06-10"),
    (SCREENING, "ghosted", 2, "2026-06-10"),
    (SCREENING, "withdrawn", 1, "2026-06-10"),
    (APPLIED, "withdrawn", 2, "2026-06-12"),
    (TECH_INTERVIEW, "rejected", 3, "2026-07-01"),
    (APPLIED, "ghosted", 7, "2026-07-05"),
    (TECH_INTERVIEW, "rejected", 1, "2026-07-20"),
    (FINAL, "offer", 1, "2026-07-20"),
    (FINAL, "rejected", 2, "2026-07-20"),
    (FINAL, "withdrawn", 1, "2026-07-20"),
    (APPLIED, "rejected", 19, "2026-08-10"),
]

DESIGN_PERIOD = SearchPeriod(
    started_at=datetime.fromisoformat("2026-06-05T06:00Z"), timezone="Europe/Kyiv"
)
DESIGN_NOW = datetime.fromisoformat("2026-08-28T12:00Z")


def journey(flow: DesignFlow) -> list[TimedMove]:
    path, outcome, _, sent = flow
    started = datetime.fromisoformat(sent + SENT_AT)
    entries = [(stage, started + timedelta(days=ENTRY_DAYS[stage])) for stage in path]
    ended = entries[-1][1] + timedelta(days=OUTCOME_LAG_DAYS)
    return [*entries, (outcome, ended)]


def design_frame() -> pd.DataFrame:
    return timed_frame([journey(flow) for flow in DESIGN_FLOWS for _ in range(flow[2])])
