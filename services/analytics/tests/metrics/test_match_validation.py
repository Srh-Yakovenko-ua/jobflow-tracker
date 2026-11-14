import pytest

from app.metrics.match_validation import (
    MatchValidation,
    ScoreStatistics,
    match_validation,
)
from app.metrics.rate import Insufficient
from tests.metrics.match_validation_design import (
    DEPENDENT_EFFECT,
    DEPENDENT_SEED,
    GHOSTED,
    REACHED_INTERVIEW,
    REACHED_SCREENING,
    SCORED_APPLICATIONS,
    UNSCORED_APPLICATIONS,
    Scenario,
    dependent,
    four_in_the_top_bucket,
    random_outcomes,
    scenario,
    scored_applications,
)
from tests.metrics.sankey_fixtures import Journey


def validated(scenario: Scenario) -> MatchValidation:
    return match_validation(scenario.events, scores=scenario.scores)


def statistics_of(scenario: Scenario) -> ScoreStatistics:
    statistics = validated(scenario).statistics
    assert isinstance(statistics, ScoreStatistics)
    return statistics


def test_detects_that_outcomes_depend_on_the_score() -> None:
    statistics = statistics_of(dependent())

    assert statistics.significant
    assert statistics.correlation > 0
    assert statistics.p_value < 0.05
    assert statistics.regression is not None
    assert statistics.regression.low > 0
    assert statistics.message == (
        "Вакансії зі збігом 75+ доходять до інтерв'ю у 3,7 раза частіше, ніж до 50"
    )


def test_says_honestly_that_random_outcomes_are_not_predicted() -> None:
    statistics = statistics_of(random_outcomes())

    assert not statistics.significant
    assert statistics.p_value >= 0.05
    assert statistics.regression is not None
    assert statistics.regression.low < 0 < statistics.regression.high
    assert (
        statistics.message
        == "Match Score поки не передбачає, чи дійде заявка до інтерв'ю"
    )


def test_says_when_a_higher_score_reaches_interview_less_often() -> None:
    statistics = statistics_of(scenario(DEPENDENT_SEED, effect=-DEPENDENT_EFFECT))

    assert (statistics.significant, statistics.correlation < 0) == (True, True)
    assert statistics.message == "Заявки з вищим Match Score доходять до інтерв'ю рідше"


def test_shows_no_percent_for_a_bucket_of_4_applications() -> None:
    top = validated(four_in_the_top_bucket()).buckets[-1]

    assert (top.bucket, top.applications) == ("from_75", 4)
    for share in (top.screening, top.interview):
        assert share.model_dump(by_alias=True) == {
            "status": "insufficient_data",
            "have": 4,
            "need": 1,
            "message": "Ще 1 відгук до першого висновку",
        }


def test_needs_5_applications_on_each_side_of_the_interview_for_statistics() -> None:
    assert validated(four_in_the_top_bucket()).statistics == Insufficient(
        have=4,
        need=1,
        message="Для висновку потрібно щонайменше 5 заявок, що дійшли до інтерв'ю, "
        "і 5, що не дійшли",
    )


def test_counts_unscored_applications_apart_from_every_bucket() -> None:
    result = validated(dependent())

    assert (result.scored, result.unscored) == (
        SCORED_APPLICATIONS,
        UNSCORED_APPLICATIONS,
    )
    assert sum(bucket.applications for bucket in result.buckets) == result.scored
    assert statistics_of(dependent()).applications == result.scored


def test_puts_49_below_50_and_74_with_50_and_75_on_top() -> None:
    result = validated(
        scored_applications(
            [(49, GHOSTED), (50, REACHED_SCREENING), (74, GHOSTED), (75, GHOSTED)]
        )
    )

    assert [(bucket.bucket, bucket.applications) for bucket in result.buckets] == [
        ("below_50", 1),
        ("from_50_to_74", 2),
        ("from_75", 1),
    ]


@pytest.mark.parametrize(
    ("journey", "reached"),
    [
        (GHOSTED, [0, 0]),
        (REACHED_SCREENING, [5, 0]),
        (REACHED_INTERVIEW, [5, 5]),
    ],
    ids=["ghosted", "screening", "interview"],
)
def test_counts_a_bucket_as_reached_only_from_the_stage_on(
    journey: Journey, reached: list[int]
) -> None:
    (low, *_) = validated(scored_applications([(10, journey)] * 5)).buckets

    assert [
        share.model_dump()["successes"] for share in (low.screening, low.interview)
    ] == reached


def test_answers_insufficient_data_without_applications() -> None:
    result = validated(scored_applications([]))

    assert (result.scored, result.unscored) == (0, 0)
    assert [bucket.interview.status for bucket in result.buckets] == [
        "insufficient_data"
    ] * 3
    assert result.statistics.status == "insufficient_data"


def test_answers_in_camel_case() -> None:
    body = validated(dependent()).model_dump(by_alias=True, mode="json")

    assert sorted(body) == ["buckets", "scored", "statistics", "unscored"]
    assert sorted(body["statistics"]) == [
        "applications",
        "correlation",
        "message",
        "pValue",
        "regression",
        "significant",
        "status",
    ]
