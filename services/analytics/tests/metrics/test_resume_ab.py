from typing import Any

import pytest

from app.metrics.rate import Insufficient, Rate
from app.metrics.resume_ab import ResumeAb, ResumeAbComparison, Verdict, resume_ab
from tests.factories import day, stage_events_frame, version_links_frame
from tests.metrics.resume_ab_design import (
    SWITCH_DAY,
    Cohort,
    ab_events,
    ab_links,
    design_events,
    design_links,
)

TWO_PER_VERSION = [Cohort(2, "screening", 2, SWITCH_DAY), Cohort(1, "rejected", 2, 0)]


@pytest.fixture(scope="module")
def design() -> ResumeAb:
    return resume_ab(design_events(), links=design_links())


def compared(cohorts: list[Cohort]) -> ResumeAbComparison:
    comparison = resume_ab(ab_events(cohorts), links=ab_links(cohorts)).comparison
    assert comparison is not None
    return comparison


def dumped(result: Rate | Insufficient) -> dict[str, Any]:
    return result.model_dump(by_alias=True)


def test_lists_every_version_newest_first_with_applications_and_screenings(
    design: ResumeAb,
) -> None:
    assert [
        (row.number, row.title, row.applications, row.screenings)
        for row in design.versions
    ] == [
        (3, "для дизайн-ролей", 3, 1),
        (2, "акцент на продукті", 27, 11),
        (1, "хронологічне", 21, 5),
    ]


def test_converts_cv_v2_11_of_27_and_cv_v1_5_of_21_with_wilson_bounds(
    design: ResumeAb,
) -> None:
    v3, v2, v1 = (row.conversion for row in design.versions)

    assert v3 == Insufficient(
        have=3, need=2, message="Ще 2 відгуки до першого висновку"
    )
    assert dumped(v2) == pytest.approx(
        {
            "status": "ok",
            "value": 0.4074,
            "low": 0.2451,
            "high": 0.5927,
            "successes": 11,
            "trials": 27,
        },
        abs=1e-4,
    )
    assert dumped(v1) == pytest.approx(
        {
            "status": "ok",
            "value": 0.2381,
            "low": 0.1063,
            "high": 0.4509,
            "successes": 5,
            "trials": 21,
        },
        abs=1e-4,
    )


def test_compares_the_two_most_used_versions_by_a_z_test(design: ResumeAb) -> None:
    comparison = design.comparison
    assert comparison is not None

    assert (comparison.challenger, comparison.baseline, comparison.test) == (
        2,
        1,
        "z_test",
    )
    assert (comparison.difference, comparison.p_value) == pytest.approx(
        (0.1693, 0.2170), abs=1e-4
    )
    assert comparison.probability_better == pytest.approx(0.8836, abs=0.005)
    assert comparison.verdict == Verdict(winner=2, message="Схоже, CV v2 працює краще")


def test_shows_conversion_rising_from_24_to_41_percent_after_the_switch(
    design: ResumeAb,
) -> None:
    comparison = design.comparison
    assert comparison is not None
    switch = comparison.model_dump(by_alias=True, mode="json")["switch"]

    assert switch["at"] == "2026-12-02T09:00:00Z"
    assert comparison.switch.at == day(SWITCH_DAY)
    assert [
        (side["successes"], side["trials"])
        for side in (switch["before"], switch["after"])
    ] == [
        (5, 21),
        (11, 27),
    ]


def test_answers_in_camel_case(design: ResumeAb) -> None:
    body = design.model_dump(by_alias=True, mode="json")

    assert sorted(body["versions"][0]) == [
        "applications",
        "conversion",
        "number",
        "resumeVersionId",
        "screenings",
        "title",
    ]
    assert sorted(body["comparison"]) == [
        "baseline",
        "challenger",
        "difference",
        "pValue",
        "probabilityBetter",
        "switch",
        "test",
        "verdict",
    ]


def test_names_no_winner_with_two_applications_per_version() -> None:
    comparison = compared(TWO_PER_VERSION)

    assert comparison.verdict == Insufficient(
        have=2, need=8, message="Ще 8 відгуків до першого висновку"
    )
    assert (comparison.test, comparison.p_value) == pytest.approx(
        ("fisher_exact", 0.3333), abs=1e-4
    )
    assert comparison.probability_better == pytest.approx(0.95, abs=0.005)


@pytest.mark.parametrize(
    ("cohorts", "verdict"),
    [
        (
            [Cohort(2, "screening", 9, SWITCH_DAY), Cohort(1, "rejected", 10, 0)],
            Insufficient(have=9, need=1, message="Ще 1 відгук до першого висновку"),
        ),
        (
            [Cohort(2, "screening", 10, SWITCH_DAY), Cohort(1, "rejected", 10, 0)],
            Verdict(winner=2, message="CV v2 працює краще"),
        ),
        (
            [Cohort(2, "rejected", 10, SWITCH_DAY), Cohort(1, "screening", 10, 0)],
            Verdict(winner=1, message="CV v1 працює краще"),
        ),
        (
            [
                Cohort(2, "screening", 5, SWITCH_DAY),
                Cohort(2, "rejected", 5, SWITCH_DAY),
                Cohort(1, "screening", 5, 0),
                Cohort(1, "rejected", 5, 0),
            ],
            Verdict(winner=None, message="Різниці між CV v2 і CV v1 поки не видно"),
        ),
    ],
    ids=["9 trials", "10 trials", "the baseline wins", "no difference"],
)
def test_names_a_winner_only_from_10_trials_per_version(
    cohorts: list[Cohort], verdict: Verdict | Insufficient
) -> None:
    assert compared(cohorts).verdict == verdict


def test_leaves_ghosted_applications_out_of_a_versions_trials() -> None:
    cohorts = [Cohort(1, "screening", 5, 0), Cohort(1, "ghosted", 3, 0)]

    (row,) = resume_ab(ab_events(cohorts), links=ab_links(cohorts)).versions

    assert (row.applications, row.screenings, dumped(row.conversion)["trials"]) == (
        8,
        5,
        5,
    )


def test_compares_nothing_with_a_single_version() -> None:
    cohorts = [Cohort(1, "screening", 12, 0)]

    assert resume_ab(ab_events(cohorts), links=ab_links(cohorts)).comparison is None


def test_answers_no_versions_without_events() -> None:
    assert resume_ab(stage_events_frame([]), links=version_links_frame([])) == ResumeAb(
        versions=[], comparison=None
    )
