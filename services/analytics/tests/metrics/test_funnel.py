from datetime import timedelta

import pytest

from app.metrics.funnel import Funnel, funnel
from app.metrics.kpis import SearchPeriod
from app.metrics.rate import Insufficient, Rate
from tests.factories import (
    EVENTS_BASE_TIME,
    StageEvent,
    application,
    moves,
    stage_event,
    stage_events_frame,
)

PERIOD = SearchPeriod(started_at=EVENTS_BASE_TIME, timezone="Europe/Kyiv")
NOW = EVENTS_BASE_TIME + timedelta(days=30)
NOTHING_LOST = {"rejected": 0, "ghosted": 0, "withdrawn": 0}

SCREENED_THEN_REJECTED = moves(application(0), ["applied", "screening", "rejected"])
SKIPPED_SCREENING = moves(application(0), ["applied", "tech_interview"])
CREATED, SCREENED = moves(application(0), ["applied", "screening"])
UNDONE_SCREENING = [
    CREATED,
    SCREENED,
    stage_event(
        application(0), "applied", from_stage="screening", compensates=SCREENED.id
    ),
]
REVIVED_GHOSTED = moves(
    application(0), ["applied", "screening", "ghosted", "screening"]
)
GHOSTED_AT_TECH_INTERVIEW = [
    *(
        move
        for index in range(5)
        for move in moves(
            application(index), ["applied", "screening", "tech_interview", "final"]
        )
    ),
    *moves(application(5), ["applied", "screening", "tech_interview", "ghosted"]),
]

FIXTURES: dict[str, tuple[list[StageEvent], list[tuple[int, int | None]]]] = {
    "screened then rejected": (
        SCREENED_THEN_REJECTED,
        [(1, 1), (1, 0), (0, 0), (0, 0), (0, None)],
    ),
    "skipped screening": (
        SKIPPED_SCREENING,
        [(1, 1), (1, 1), (1, 0), (0, 0), (0, None)],
    ),
    "undone screening": (UNDONE_SCREENING, [(1, 0), (0, 0), (0, 0), (0, 0), (0, None)]),
    "revived ghosted": (REVIVED_GHOSTED, [(1, 1), (1, 0), (0, 0), (0, 0), (0, None)]),
    "ghosted at tech interview": (
        GHOSTED_AT_TECH_INTERVIEW,
        [(6, 6), (6, 6), (6, 5), (5, 0), (0, None)],
    ),
    "no events": ([], [(0, 0), (0, 0), (0, 0), (0, 0), (0, None)]),
}


def funnel_of(rows: list[StageEvent]) -> Funnel:
    return funnel(stage_events_frame(rows), period=PERIOD, now=NOW)


@pytest.mark.parametrize(
    ("rows", "counts"), list(FIXTURES.values()), ids=list(FIXTURES)
)
def test_counts_every_stage_an_application_reached_or_passed_through(
    rows: list[StageEvent], counts: list[tuple[int, int | None]]
) -> None:
    stages = funnel_of(rows).stages

    assert [stage.stage for stage in stages] == [
        "applied",
        "screening",
        "tech_interview",
        "final",
        "offer",
    ]
    assert [(stage.reached, stage.passed) for stage in stages] == counts


@pytest.mark.parametrize(
    "rows", [rows for rows, _ in FIXTURES.values()], ids=list(FIXTURES)
)
def test_the_funnel_never_grows(rows: list[StageEvent]) -> None:
    reached = [stage.reached for stage in funnel_of(rows).stages]

    assert reached == sorted(reached, reverse=True)


def test_a_rejection_after_screening_drops_off_at_screening() -> None:
    applied, screening, *_ = funnel_of(SCREENED_THEN_REJECTED).stages

    assert applied.drop_off == NOTHING_LOST
    assert screening.drop_off == {"rejected": 1, "ghosted": 0, "withdrawn": 0}


def test_an_undone_move_leaves_no_drop_off() -> None:
    assert [stage.drop_off for stage in funnel_of(UNDONE_SCREENING).stages] == [
        NOTHING_LOST
    ] * 5


def test_a_revived_ghosted_application_is_not_a_ghosted_drop_off() -> None:
    screening = funnel_of(REVIVED_GHOSTED).stages[1]

    assert screening.drop_off == NOTHING_LOST


def test_an_application_ghosted_at_tech_interview_leaves_only_its_trials() -> None:
    applied, screening, tech_interview, *_ = funnel_of(GHOSTED_AT_TECH_INTERVIEW).stages
    conversions = [stage.conversion for stage in (applied, screening, tech_interview)]

    assert all(isinstance(conversion, Rate) for conversion in conversions)
    assert [
        (conversion.successes, conversion.trials)
        for conversion in conversions
        if isinstance(conversion, Rate)
    ] == [(6, 6), (6, 6), (5, 5)]
    assert tech_interview.drop_off == {"rejected": 0, "ghosted": 1, "withdrawn": 0}


def test_no_events_leave_every_conversion_short_of_the_percent_threshold() -> None:
    short = Insufficient(have=0, need=5, message="Ще 5 відгуків до першого висновку")

    assert [stage.conversion for stage in funnel_of([]).stages] == [short] * 4 + [None]


def test_dumps_to_the_camel_case_keys_of_the_shared_contract() -> None:
    dumped = funnel_of(SCREENED_THEN_REJECTED).model_dump(by_alias=True)

    assert sorted(dumped) == ["kpis", "mostExpensive", "stages"]
    assert sorted(dumped["stages"][0]) == [
        "conversion",
        "dropOff",
        "passed",
        "reached",
        "stage",
    ]
