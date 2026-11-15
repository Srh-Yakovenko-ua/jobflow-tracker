from datetime import datetime
from typing import Final

from app.metrics.salary import Salary, salary
from tests.factories import (
    SalaryRow,
    StageEvent,
    application,
    day,
    moves,
    salaries_frame,
    stage_event,
    stage_events_frame,
)

SCREENED: Final = ["applied", "screening"]
EXPECTATIONS, DECLINED, OFFERED = application(0), application(1), application(2)
OPEN_HIGHS: Final = (3000, 3200, 3400, 4000, 4400, 6000)
OPENED: Final = [application(3 + index) for index in range(len(OPEN_HIGHS))]
WITHOUT_SALARY: Final = application(9)
FLOOR_NOW: Final = day(60)


def salary_of(
    events: list[StageEvent], *, rows: list[SalaryRow], now: datetime = FLOOR_NOW
) -> Salary:
    return salary(stage_events_frame(events), salaries=salaries_frame(rows), now=now)


def floor_events(*, declined_reason: str) -> list[StageEvent]:
    return [
        *moves(EXPECTATIONS, SCREENED),
        stage_event(
            EXPECTATIONS,
            "rejected",
            from_stage="screening",
            reason="salary_expectations",
        ),
        *moves(DECLINED, SCREENED),
        stage_event(
            DECLINED, "withdrawn", from_stage="screening", reason=declined_reason
        ),
        *moves(OFFERED, [*SCREENED, "offer"]),
        *(
            event
            for opened in [*OPENED, WITHOUT_SALARY]
            for event in moves(opened, SCREENED)
        ),
    ]


def floor_rows(*, offer_high: int, declined_high: int = 4100) -> list[SalaryRow]:
    return [
        SalaryRow(EXPECTATIONS, 3500, 3800),
        SalaryRow(DECLINED, None, declined_high),
        SalaryRow(OFFERED, None, offer_high),
        *(
            SalaryRow(opened, None, high)
            for opened, high in zip(OPENED, OPEN_HIGHS, strict=True)
        ),
        SalaryRow(WITHOUT_SALARY, None, None),
    ]
