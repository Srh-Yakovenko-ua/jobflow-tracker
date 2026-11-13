from app.metrics.norms import norms
from app.metrics.timings import timings
from tests.metrics.timings_design import (
    DESIGN_NORMS_BODY,
    DESIGN_TIMINGS_BODY,
    design_events,
    design_followups,
)


def test_the_design_fixture_gives_the_final_stage_a_norm_of_17_days() -> None:
    assert norms(design_events()).stage_norm_days["final"] == 17


def test_answers_the_design_norms_body() -> None:
    assert norms(design_events()).model_dump(by_alias=True) == DESIGN_NORMS_BODY


def test_answers_the_design_timings_body_with_medians_4_7_9_and_17_days() -> None:
    body = timings(design_events(), followups=design_followups()).model_dump(
        by_alias=True, mode="json"
    )

    assert [stage["medianDays"] for stage in body["stages"]] == [4, 7, 9, 17]
    assert body == DESIGN_TIMINGS_BODY
