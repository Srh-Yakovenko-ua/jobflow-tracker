from app.metrics.data_rules import clean_events
from app.metrics.journeys import journeys
from app.metrics.rate import Insufficient
from app.metrics.response_time import (
    ResponseTime,
    median_response,
    response_days,
)
from tests.metrics.sankey_fixtures import DatedMove, dated_frame

SENT: DatedMove = ("applied", None, 0)

SIX_REPLIES: list[list[DatedMove]] = [
    [SENT, ("screening", None, 1)],
    [SENT, ("tech_interview", None, 2.5)],
    [SENT, ("rejected", "skills_gap", 4)],
    [SENT, ("rejected", None, 7)],
    [SENT, ("screening", None, 10), ("rejected", "no_explanation", 11)],
    [SENT, ("ghosted", None, 9), ("screening", None, 12)],
]


def median_of(paths: list[list[DatedMove]]) -> ResponseTime | Insufficient:
    clean = clean_events(dated_frame(paths))
    days = response_days(clean, started_at=journeys(clean)["started_at"])
    return median_response(days)


def test_takes_the_median_of_the_days_to_the_first_reply() -> None:
    assert median_of(SIX_REPLIES) == ResponseTime(days=5.5, samples=6)


def test_a_rejection_on_the_candidate_side_is_not_a_reply() -> None:
    declined = [[SENT, ("rejected", "low_salary", 3)]] * 4

    assert median_of(SIX_REPLIES[:4] + declined) == Insufficient(
        have=4, need=1, message="Ще 1 відгук до першого висновку"
    )


def test_an_application_still_waiting_gives_no_sample() -> None:
    waiting = [[SENT], [SENT, ("ghosted", None, 14)], [SENT, ("withdrawn", None, 2)]]

    assert median_of(SIX_REPLIES[:5] + waiting) == ResponseTime(days=4.0, samples=5)


def test_answers_insufficient_data_below_five_replies() -> None:
    assert median_of(SIX_REPLIES[:2]) == Insufficient(
        have=2, need=3, message="Ще 3 відгуки до першого висновку"
    )


def test_answers_insufficient_data_without_events() -> None:
    assert median_of([]) == Insufficient(
        have=0, need=5, message="Ще 5 відгуків до першого висновку"
    )
