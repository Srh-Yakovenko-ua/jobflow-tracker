import pytest

from app.metrics.rate import Insufficient, Rate
from app.metrics.response_time import ResponseTime
from app.metrics.sources import SilentGhosts, SourcePerformance, Sources, sources
from tests.factories import (
    ApplicationSource,
    application,
    application_sources_frame,
    moves,
    stage_events_frame,
)
from tests.metrics.sources_design import (
    EASY_APPLY,
    design_events,
    design_origins,
)

SMALL_BUT_CLEAR = "вибірка мала, але напрям однозначний"


@pytest.fixture(scope="module")
def design() -> Sources:
    return sources(design_events(), origins=design_origins())


@pytest.fixture(scope="module")
def rows(design: Sources) -> dict[str, SourcePerformance]:
    return {row.source: row for row in design.sources}


def bounds(result: Rate | Insufficient) -> tuple[float, ...]:
    assert isinstance(result, Rate)
    return (result.successes, result.trials, result.value, result.low, result.high)


def test_the_design_fixture_holds_56_applications() -> None:
    assert design_origins()["application_id"].nunique() == 56
    assert design_events()["application_id"].nunique() == 56


def test_ranks_djinni_first_and_the_small_samples_last(design: Sources) -> None:
    assert [row.source for row in design.sources] == [
        "djinni",
        "dou",
        "linkedin",
        "referral",
        "company_site",
    ]


def test_counts_applications_screenings_and_easy_apply_per_source(
    design: Sources,
) -> None:
    assert [
        (row.source, row.applications, row.screenings, row.easy_apply)
        for row in design.sources
    ] == [
        ("djinni", 24, 9, 0),
        ("dou", 11, 2, 0),
        ("linkedin", 16, 2, 6),
        ("referral", 3, 3, 0),
        ("company_site", 2, 1, 0),
    ]


def test_converts_to_screening_with_silent_ghosts_left_out_of_the_trials(
    rows: dict[str, SourcePerformance],
) -> None:
    assert bounds(rows["djinni"].conversion) == pytest.approx(
        (9, 22, 0.4091, 0.2326, 0.6127), abs=1e-4
    )
    assert bounds(rows["dou"].conversion) == pytest.approx(
        (2, 11, 0.1818, 0.0514, 0.4770), abs=1e-4
    )
    assert bounds(rows["linkedin"].conversion) == pytest.approx(
        (2, 12, 0.1667, 0.0470, 0.4480), abs=1e-4
    )
    assert [rows[source].conversion for source in ("referral", "company_site")] == [
        Insufficient(have=3, need=2, message="Ще 2 відгуки до першого висновку"),
        Insufficient(have=2, need=3, message="Ще 3 відгуки до першого висновку"),
    ]


def test_counts_the_ghost_rate_over_all_applications_of_a_source(
    rows: dict[str, SourcePerformance],
) -> None:
    assert bounds(rows["djinni"].ghost_rate) == pytest.approx(
        (2, 24, 0.0833, 0.0232, 0.2585), abs=1e-4
    )
    assert bounds(rows["linkedin"].ghost_rate) == pytest.approx(
        (4, 16, 0.25, 0.1018, 0.4950), abs=1e-4
    )
    assert bounds(rows["dou"].ghost_rate) == pytest.approx(
        (0, 11, 0.0, 0.0, 0.2588), abs=1e-4
    )
    assert rows["referral"].ghost_rate == Insufficient(
        have=3, need=2, message="Ще 2 відгуки до першого висновку"
    )


def test_takes_the_median_days_to_a_reply_per_source(
    rows: dict[str, SourcePerformance],
) -> None:
    assert {source: row.median_response for source, row in rows.items()} == {
        "djinni": ResponseTime(days=6.0, samples=22),
        "dou": ResponseTime(days=2.5, samples=11),
        "linkedin": ResponseTime(days=12.0, samples=12),
        "referral": Insufficient(
            have=3, need=2, message="Ще 2 відгуки до першого висновку"
        ),
        "company_site": Insufficient(
            have=2, need=3, message="Ще 3 відгуки до першого висновку"
        ),
    }


def test_marks_only_the_referrals_as_small_but_clear(
    rows: dict[str, SourcePerformance],
) -> None:
    assert {source: row.note for source, row in rows.items()} == {
        "djinni": None,
        "dou": None,
        "linkedin": None,
        "referral": SMALL_BUT_CLEAR,
        "company_site": None,
    }


def test_counts_six_silent_ghosts_four_of_them_linkedin_easy_apply(
    design: Sources,
) -> None:
    assert design.model_dump(by_alias=True)["silentGhosts"] == {
        "total": 6,
        "easyApply": 4,
    }


def test_flags_easy_apply_only_on_linkedin_applications() -> None:
    events = stage_events_frame(
        [
            event
            for index in range(3)
            for event in moves(application(index), ["applied"])
        ]
    )
    origins = application_sources_frame(
        [
            ApplicationSource(application(0), "djinni", EASY_APPLY),
            ApplicationSource(application(1), "linkedin", None),
            ApplicationSource(application(2), "linkedin", EASY_APPLY),
        ]
    )

    flagged = sources(events, origins=origins).sources

    assert [(row.source, row.easy_apply) for row in flagged] == [
        ("linkedin", 1),
        ("djinni", 0),
    ]


def test_answers_no_sources_without_events() -> None:
    assert sources(
        stage_events_frame([]), origins=application_sources_frame([])
    ) == Sources(sources=[], silent_ghosts=SilentGhosts(total=0, easy_apply=0))
