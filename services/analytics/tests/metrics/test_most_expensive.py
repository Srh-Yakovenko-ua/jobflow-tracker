import pytest

from app.metrics.data_rules import clean_events
from app.metrics.journeys import journeys
from app.metrics.most_expensive import MostExpensiveStage, most_expensive
from app.metrics.rate import Insufficient
from tests.factories import TimedMove, day, timed_frame

TECH_INTERVIEW_COST = MostExpensiveStage(
    stage="tech_interview", reached=3, passed=1, lost=2, invested_days_median=10.0
)


def on_days(stages: list[str], days: list[float]) -> list[TimedMove]:
    return [(stage, day(offset)) for stage, offset in zip(stages, days, strict=True)]


def ten_applications(*, final_entry: float) -> list[list[TimedMove]]:
    return [
        *[on_days(["applied", "rejected"], [0, 1])] * 4,
        *[on_days(["applied", "screening", "rejected"], [0, 3, 4])] * 3,
        *[
            on_days(
                ["applied", "screening", "tech_interview", "ghosted"], [0, 3, 10, 20]
            )
        ]
        * 2,
        on_days(
            ["applied", "screening", "tech_interview", "final", "withdrawn"],
            [0, 3, 10, final_entry, 30],
        ),
    ]


def leader(paths: list[list[TimedMove]]) -> MostExpensiveStage | Insufficient | None:
    return most_expensive(journeys(clean_events(timed_frame(paths))))


def test_nine_applications_need_one_more_for_the_insight() -> None:
    assert leader(ten_applications(final_entry=15)[1:]) == Insufficient(
        have=9, need=1, message="Ще 1 відгук до першого висновку"
    )


def test_no_events_need_the_whole_insight_threshold() -> None:
    result = leader([])

    assert isinstance(result, Insufficient)
    assert (result.have, result.need) == (0, 10)


def test_no_loss_names_no_stage() -> None:
    assert leader([on_days(["applied", "screening"], [0, 2])] * 10) is None


@pytest.mark.parametrize(
    ("final_entry", "cost_leader"),
    [
        (15, TECH_INTERVIEW_COST),
        (
            20,
            MostExpensiveStage(
                stage="final", reached=1, passed=0, lost=1, invested_days_median=20.0
            ),
        ),
        (
            25,
            MostExpensiveStage(
                stage="final", reached=1, passed=0, lost=1, invested_days_median=25.0
            ),
        ),
    ],
    ids=["tech interview costs more", "a tie goes deeper", "final costs more"],
)
def test_ten_applications_name_the_stage_whose_losses_cost_the_most_days(
    final_entry: float, cost_leader: MostExpensiveStage
) -> None:
    assert leader(ten_applications(final_entry=final_entry)) == cost_leader


def test_dumps_to_the_camel_case_keys_of_the_shared_contract() -> None:
    assert TECH_INTERVIEW_COST.model_dump(by_alias=True) == {
        "status": "ok",
        "stage": "tech_interview",
        "reached": 3,
        "passed": 1,
        "lost": 2,
        "investedDaysMedian": 10.0,
    }
