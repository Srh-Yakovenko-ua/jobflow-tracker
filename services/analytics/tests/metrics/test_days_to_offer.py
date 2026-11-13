from app.metrics.data_rules import clean_events
from app.metrics.days_to_offer import days_to_offer
from app.metrics.rate import Insufficient
from app.metrics.response_time import ResponseTime, median_response
from tests.metrics.sankey_fixtures import DatedMove, dated_frame

SENT: DatedMove = ("applied", None, 0)


def offer_path(offer_day: float) -> list[DatedMove]:
    return [SENT, ("screening", None, offer_day / 2), ("offer", None, offer_day)]


def median_to_offer(paths: list[list[DatedMove]]) -> ResponseTime | Insufficient:
    return median_response(days_to_offer(clean_events(dated_frame(paths))))


def test_measures_from_the_first_event_to_the_offer_per_application() -> None:
    accepted_elsewhere = [*offer_path(40), ("withdrawn", None, 45)]
    started_late = [("applied", None, 3), ("offer", None, 37)]
    paths = [offer_path(day) for day in (20, 30, 61)]

    assert sorted(
        days_to_offer(clean_events(dated_frame([*paths, accepted_elsewhere])))
    ) == [20.0, 30.0, 40.0, 61.0]
    assert median_to_offer([*paths, accepted_elsewhere, started_late]) == (
        ResponseTime(days=34.0, samples=5)
    )


def test_leaves_out_applications_that_never_reached_an_offer() -> None:
    paths = [
        *(offer_path(day) for day in (20, 30, 34, 40)),
        [SENT, ("final", None, 25), ("rejected", "chose_other", 29)],
        [SENT, ("ghosted", None, 21)],
        [SENT],
    ]

    assert median_to_offer(paths) == Insufficient(
        have=4, need=1, message="Ще 1 відгук до першого висновку"
    )


def test_answers_insufficient_data_without_events() -> None:
    assert median_to_offer([]) == Insufficient(
        have=0, need=5, message="Ще 5 відгуків до першого висновку"
    )
