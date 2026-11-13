from typing import Any, NamedTuple

import pandas as pd
import pytest

from app.metrics.rate import Insufficient, Rate
from app.metrics.reason_tallies import ReasonCount
from app.metrics.reasons import Reasons, StageReasons, reasons
from app.metrics.reasons_trend import ReasonsTrend, TopReason
from tests.factories import application, stage_event, stage_events_frame
from tests.metrics.funnel_design import FINAL, TECH_INTERVIEW
from tests.metrics.reasons_design import (
    DESIGN_NOW,
    WAITING_AT_SCREENING,
    aged,
    design_frame,
    design_journeys,
)
from tests.metrics.sankey_fixtures import (
    APPLIED,
    SCREENING,
    Journey,
    cohort,
    reasoned_events,
    reasoned_frame,
    rejected_at,
)

BELOW_FIRST_CONCLUSION = {
    "status": "insufficient_data",
    "have": 4,
    "need": 1,
    "message": "Ще 1 відгук до першого висновку",
}
NOTHING_STATED = {
    "status": "insufficient_data",
    "have": 0,
    "need": 5,
    "message": "Ще 5 відгуків до першого висновку",
}
TECH_INTERVIEW_TOP = TopReason(stage="tech_interview", code="skills_gap", count=3, of=4)

DESIGN_TECH_INTERVIEW: dict[str, Any] = {
    "stage": "tech_interview",
    "total": 4,
    "stated": 4,
    "sides": {
        "company": {"count": 4, "share": BELOW_FIRST_CONCLUSION},
        "candidate": {"count": 0, "share": BELOW_FIRST_CONCLUSION},
    },
    "reasons": [
        {"code": "skills_gap", "count": 3, "share": BELOW_FIRST_CONCLUSION},
        {"code": "english_level", "count": 1, "share": BELOW_FIRST_CONCLUSION},
    ],
    "unstated": [],
    "top": {
        "status": "ok",
        "stage": "tech_interview",
        "code": "skills_gap",
        "count": 3,
        "of": 4,
    },
    "trend": {"previous": None, "changed": False},
}

DESIGN_SCREENING: dict[str, Any] = {
    "stage": "screening",
    "total": 1,
    "stated": 0,
    "sides": {
        "company": {"count": 0, "share": NOTHING_STATED},
        "candidate": {"count": 0, "share": NOTHING_STATED},
    },
    "reasons": [],
    "unstated": [{"code": "unspecified", "count": 1}],
    "top": None,
    "trend": None,
}

WAITING = cohort(APPLIED, end=("screening", None), count=10)


def reasons_of(frame: pd.DataFrame, *, stage: str | None = None) -> Reasons:
    return reasons(frame, stage=stage, now=DESIGN_NOW)


def stage_of(result: Reasons, *, stage: str) -> StageReasons:
    return next(listed for listed in result.stages if listed.stage == stage)


def test_three_of_four_tech_interview_rejections_are_a_skills_gap() -> None:
    result = reasons_of(design_frame())

    tech_interview = stage_of(result, stage="tech_interview")
    assert tech_interview.model_dump(by_alias=True) == DESIGN_TECH_INTERVIEW
    assert result.headline == TECH_INTERVIEW_TOP


def test_lists_every_stage_a_rejection_can_leave_in_stage_order() -> None:
    stages = [listed.stage for listed in reasons_of(design_frame()).stages]

    assert stages == ["applied", "screening", "tech_interview", "final"]


def test_an_unspecified_rejection_is_shown_apart_from_the_stated_ones() -> None:
    screening = stage_of(reasons_of(design_frame()), stage="screening")

    assert screening.model_dump(by_alias=True) == DESIGN_SCREENING


@pytest.mark.parametrize(
    ("ghosted", "top"),
    [
        (0, Insufficient(have=9, need=1, message="Ще 1 відгук до першого висновку")),
        (1, TECH_INTERVIEW_TOP),
    ],
    ids=["nine applications", "ten applications"],
)
def test_the_top_reason_waits_for_ten_applications_in_scope(
    ghosted: int, top: TopReason | Insufficient
) -> None:
    result = reasons_of(design_frame(ghosted=ghosted))

    assert stage_of(result, stage="tech_interview").top == top
    assert result.headline == top


def test_no_events_wait_for_the_whole_insight_threshold() -> None:
    result = reasons_of(reasoned_frame([]))

    assert [listed.total for listed in result.stages] == [0, 0, 0, 0]
    assert result.headline == Insufficient(
        have=0, need=10, message="Ще 10 відгуків до першого висновку"
    )


def test_two_leading_reasons_name_no_top_reason() -> None:
    frame = reasoned_frame(
        [
            *rejected_at(TECH_INTERVIEW, reason="skills_gap", count=2),
            *rejected_at(TECH_INTERVIEW, reason="english_level", count=2),
            *WAITING,
        ]
    )
    result = reasons_of(frame)

    tech_interview = stage_of(result, stage="tech_interview")
    assert (tech_interview.top, tech_interview.trend, result.headline) == (
        None,
        None,
        None,
    )


def test_an_undone_rejection_changes_nothing() -> None:
    waiting = application(WAITING_AT_SCREENING)
    rejection = stage_event(
        waiting, "rejected", from_stage="screening", reason="skills_gap"
    )
    undo = stage_event(
        waiting, "screening", from_stage="rejected", compensates=rejection.id
    )
    events = [*reasoned_events(design_journeys()), rejection, undo]

    assert reasons_of(stage_events_frame(events)) == reasons_of(design_frame())


def test_system_reasons_stay_out_of_the_shares_and_the_top_reason() -> None:
    frame = reasoned_frame(
        [
            *design_journeys(),
            *rejected_at(TECH_INTERVIEW, reason="silence_timeout", count=2),
            *rejected_at(TECH_INTERVIEW, reason="unspecified", count=1),
            *cohort(TECH_INTERVIEW, end=("rejected", None), count=1),
        ]
    )
    tech_interview = stage_of(reasons_of(frame), stage="tech_interview")

    assert (tech_interview.total, tech_interview.stated) == (8, 4)
    assert tech_interview.unstated == [
        ReasonCount(code="silence_timeout", count=2),
        ReasonCount(code="unspecified", count=2),
    ]
    assert [reason.code for reason in tech_interview.reasons] == [
        "skills_gap",
        "english_level",
    ]
    assert tech_interview.top == TECH_INTERVIEW_TOP


def test_company_and_candidate_sides_split_the_stated_rejections() -> None:
    frame = reasoned_frame(
        [
            *rejected_at(FINAL, reason="skills_gap", count=3),
            *rejected_at(FINAL, reason="low_salary", count=2),
            *WAITING,
        ]
    )
    sides = stage_of(reasons_of(frame), stage="final").sides

    company, candidate = sides["company"].share, sides["candidate"].share
    assert isinstance(company, Rate)
    assert isinstance(candidate, Rate)
    assert (sides["company"].count, sides["candidate"].count) == (3, 2)
    assert (company.value, company.low, company.high) == pytest.approx(
        (0.6, 0.2307, 0.8824), abs=1e-4
    )
    assert (candidate.successes, candidate.trials) == (2, 5)


def leaders_at(*, screening: list[Journey], tech_interview: list[Journey]) -> Reasons:
    return reasons_of(reasoned_frame([*screening, *tech_interview, *WAITING]))


THREE_OF_FOUR_AT_TECH_INTERVIEW = [
    *rejected_at(TECH_INTERVIEW, reason="skills_gap", count=3),
    *rejected_at(TECH_INTERVIEW, reason="english_level", count=1),
]


@pytest.mark.parametrize(
    ("screening", "headline"),
    [
        (
            rejected_at(SCREENING, reason="chose_other", count=2),
            TECH_INTERVIEW_TOP,
        ),
        (
            rejected_at(SCREENING, reason="red_flags", count=3),
            TopReason(stage="screening", code="red_flags", count=3, of=3),
        ),
        (
            [
                *rejected_at(SCREENING, reason="chose_other", count=3),
                *rejected_at(SCREENING, reason="low_salary", count=1),
            ],
            TECH_INTERVIEW_TOP,
        ),
    ],
    ids=["more rejections", "a larger share", "a tie goes deeper"],
)
def test_the_headline_is_the_strongest_stage_leader(
    screening: list[Journey], headline: TopReason
) -> None:
    result = leaders_at(
        screening=screening, tech_interview=THREE_OF_FOUR_AT_TECH_INTERVIEW
    )

    assert result.headline == headline


class Earlier(NamedTuple):
    reason: str
    days_ago: int


@pytest.mark.parametrize(
    ("earlier", "trend"),
    [
        (
            Earlier("chose_other", 60),
            ReasonsTrend(previous="chose_other", changed=True),
        ),
        (Earlier("skills_gap", 60), ReasonsTrend(previous="skills_gap", changed=False)),
        (Earlier("chose_other", 0), ReasonsTrend(previous=None, changed=False)),
    ],
    ids=["top reason changed", "top reason kept", "nothing before the window"],
)
def test_the_trend_compares_the_top_reason_with_the_one_before_thirty_days(
    earlier: Earlier, trend: ReasonsTrend
) -> None:
    journeys = [
        *rejected_at(TECH_INTERVIEW, reason=earlier.reason, count=2),
        *design_journeys(),
    ]
    frame = aged(reasoned_frame(journeys), first=2, days=earlier.days_ago)

    assert stage_of(reasons_of(frame), stage="tech_interview").trend == trend


def test_a_stage_filter_answers_only_that_stage() -> None:
    result = reasons_of(design_frame(), stage="screening")

    assert [listed.stage for listed in result.stages] == ["screening"]
    assert result.headline is None
