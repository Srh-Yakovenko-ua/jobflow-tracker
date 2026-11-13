from app.metrics.data_rules import clean_events
from app.metrics.journeys import journeys
from app.metrics.rate import Insufficient
from app.metrics.response_time import (
    ResponseHours,
    ResponseTime,
    median_response,
    median_response_hours,
    response_days,
    response_hours,
)
from tests.factories import Followup, application, day, followups_frame
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


def hours_of(
    paths: list[list[DatedMove]], *, followed_up: list[tuple[int, float]]
) -> list[float]:
    followups = followups_frame(
        [Followup(application(index), day(offset)) for index, offset in followed_up]
    )
    return sorted(response_hours(clean_events(dated_frame(paths)), followups=followups))


def test_a_reply_ends_the_wait_since_the_latest_follow_up() -> None:
    assert hours_of(
        [[SENT, ("screening", None, 6)], [SENT, ("screening", None, 2)]],
        followed_up=[(0, 5)],
    ) == [24.0, 48.0]


def test_a_reply_with_no_open_wait_gives_no_sample() -> None:
    assert hours_of(
        [
            [
                SENT,
                ("screening", None, 1),
                ("tech_interview", None, 5),
                ("tech_interview", None, 8),
                ("final", None, 9.5),
            ]
        ],
        followed_up=[(0, 3), (0, 9)],
    ) == [12.0, 24.0, 48.0]


def test_a_candidate_side_rejection_a_withdrawal_or_a_ghosting_is_no_reply() -> None:
    assert hours_of(
        [
            [SENT, ("rejected", "low_salary", 3)],
            [SENT, ("ghosted", None, 14), ("screening", None, 15)],
            [SENT, ("withdrawn", None, 2)],
        ],
        followed_up=[(2, 1)],
    ) == [360.0]


def median_hours_of(reply_days: tuple[float, ...]) -> ResponseHours | Insufficient:
    paths = [[SENT, ("screening", None, offset)] for offset in reply_days]
    clean = clean_events(dated_frame(paths))
    return median_response_hours(response_hours(clean, followups=followups_frame([])))


def test_takes_the_median_reply_in_hours_from_five_waits() -> None:
    assert median_hours_of((1, 2, 2.5, 4, 10)) == ResponseHours(hours=60.0, samples=5)


def test_answers_insufficient_data_below_five_company_replies() -> None:
    assert median_hours_of((1, 2, 4, 10)) == Insufficient(
        have=4, need=1, message="Ще 1 відгук до першого висновку"
    )
