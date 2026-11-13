from app.metrics.reasons_summary import reasons_summary
from tests.metrics.funnel_design import TECH_INTERVIEW
from tests.metrics.reasons_design import design_frame
from tests.metrics.sankey_fixtures import SCREENING, cohort, reasoned_frame, rejected_at


def test_equal_counts_keep_the_taxonomy_order_and_system_reasons_count() -> None:
    frame = reasoned_frame(
        [
            *rejected_at(TECH_INTERVIEW, reason="english_level", count=2),
            *rejected_at(TECH_INTERVIEW, reason="chose_other", count=3),
            *rejected_at(TECH_INTERVIEW, reason="unspecified", count=1),
            *rejected_at(TECH_INTERVIEW, reason="skills_gap", count=2),
            *rejected_at(TECH_INTERVIEW, reason="silence_timeout", count=1),
            *rejected_at(SCREENING, reason="red_flags", count=5),
        ]
    )

    assert reasons_summary(frame, stage="tech_interview").model_dump(by_alias=True) == {
        "stage": "tech_interview",
        "total": 9,
        "reasons": [
            {"code": "chose_other", "count": 3},
            {"code": "skills_gap", "count": 2},
            {"code": "english_level", "count": 2},
            {"code": "silence_timeout", "count": 1},
            {"code": "unspecified", "count": 1},
        ],
    }


def test_a_rejection_without_a_reason_counts_as_unspecified() -> None:
    frame = reasoned_frame(
        [
            *cohort(SCREENING, end=("rejected", None), count=2),
            *rejected_at(SCREENING, reason="unspecified", count=1),
        ]
    )
    summary = reasons_summary(frame, stage="screening")

    assert (summary.total, summary.model_dump()["reasons"]) == (
        3,
        [{"code": "unspecified", "count": 3}],
    )


def test_a_stage_nothing_was_rejected_from_answers_zero() -> None:
    summary = reasons_summary(design_frame(), stage="offer")

    assert summary.model_dump(by_alias=True) == {
        "stage": "offer",
        "total": 0,
        "reasons": [],
    }
