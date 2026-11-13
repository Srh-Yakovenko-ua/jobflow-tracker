from itertools import pairwise

import pandas as pd

from tests.factories import (
    StageEvent,
    application,
    day,
    stage_event,
    stage_events_frame,
)

type Move = tuple[str, str | None]
type Journey = list[Move]
type DatedMove = tuple[str, str | None, float]

APPLIED = ("applied",)
SCREENING = (*APPLIED, "screening")
OFFER = (*SCREENING, "tech_interview", "final", "offer")


def reasoned_events(journeys: list[Journey]) -> list[StageEvent]:
    return [
        stage_event(application(index), stage, from_stage=previous, reason=reason)
        for index, journey in enumerate(journeys)
        for (previous, _), (stage, reason) in pairwise([(None, None), *journey])
    ]


def reasoned_frame(journeys: list[Journey]) -> pd.DataFrame:
    return stage_events_frame(reasoned_events(journeys))


def dated_frame(journeys: list[list[DatedMove]]) -> pd.DataFrame:
    moves = [[(stage, reason) for stage, reason, _ in journey] for journey in journeys]
    dates = [day(offset) for journey in journeys for *_, offset in journey]
    return stage_events_frame(reasoned_events(moves), occurred_at=dates)


def cohort(path: tuple[str, ...], *, end: Move, count: int) -> list[Journey]:
    return [[*((stage, None) for stage in path), end]] * count


def rejected_at(path: tuple[str, ...], *, reason: str, count: int) -> list[Journey]:
    return cohort(path, end=("rejected", reason), count=count)


def five_hundred_applications() -> pd.DataFrame:
    return reasoned_frame(
        [
            *cohort(OFFER[:-1], end=("offer", None), count=10),
            *cohort(APPLIED, end=("ghosted", None), count=100),
            *cohort(APPLIED, end=("withdrawn", None), count=20),
            *cohort(APPLIED, end=("screening", None), count=30),
            *rejected_at(APPLIED, reason="skills_gap", count=80),
            *rejected_at(APPLIED, reason="english_level", count=60),
            *rejected_at(APPLIED, reason="salary_expectations", count=50),
            *rejected_at(APPLIED, reason="chose_other", count=40),
            *rejected_at(APPLIED, reason="position_closed", count=35),
            *rejected_at(SCREENING, reason="no_explanation", count=30),
            *rejected_at(APPLIED, reason="low_salary", count=20),
            *rejected_at(APPLIED, reason="office_schedule", count=10),
            *rejected_at(APPLIED, reason="red_flags", count=3),
            *rejected_at(SCREENING, reason="accepted_other", count=2),
            *rejected_at(APPLIED, reason="silence_timeout", count=6),
            *rejected_at(APPLIED, reason="unspecified", count=4),
        ]
    )


def three_hundred_eighty_applications() -> pd.DataFrame:
    return reasoned_frame(
        [
            *rejected_at(APPLIED, reason="skills_gap", count=3),
            *rejected_at(APPLIED, reason="english_level", count=2),
            *cohort((), end=("applied", None), count=375),
        ]
    )
