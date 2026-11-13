from app.metrics.norms import Norms, norms
from tests.factories import stage_events_frame
from tests.metrics.sankey_fixtures import DatedMove, dated_frame

NO_NORMS = {"applied": None, "screening": None, "tech_interview": None, "final": None}


def offers(offer_days: tuple[float, ...]) -> list[list[DatedMove]]:
    return [
        [("applied", None, 0), ("offer", None, offer_day)] for offer_day in offer_days
    ]


def test_answers_no_norm_at_all_without_events() -> None:
    assert norms(stage_events_frame([])) == Norms(
        stage_norm_days=NO_NORMS, median_days_to_offer=None
    )


def test_hides_the_days_to_offer_below_five_offers() -> None:
    assert norms(dated_frame(offers((20, 30, 34.5, 40)))).median_days_to_offer is None


def test_rounds_the_median_days_to_offer_of_five_offers_to_a_whole_day() -> None:
    assert norms(dated_frame(offers((20, 30, 34.5, 40, 61)))) == Norms(
        stage_norm_days={**NO_NORMS, "applied": 35}, median_days_to_offer=35
    )
