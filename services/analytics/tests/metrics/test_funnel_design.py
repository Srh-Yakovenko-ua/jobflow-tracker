import pytest

from app.metrics.funnel import Funnel, funnel
from app.metrics.rate import Insufficient, Rate
from tests.metrics.funnel_design import DESIGN_NOW, DESIGN_PERIOD, design_frame


@pytest.fixture(scope="module")
def design() -> Funnel:
    return funnel(design_frame(), period=DESIGN_PERIOD, now=DESIGN_NOW)


def test_the_design_fixture_holds_54_applications_all_before_now() -> None:
    frame = design_frame()

    assert frame["application_id"].nunique() == 54
    assert frame["occurred_at"].max() < DESIGN_NOW


def test_counts_the_applications_that_reached_each_stage(design: Funnel) -> None:
    assert [(stage.stage, stage.reached) for stage in design.stages] == [
        ("applied", 54),
        ("screening", 17),
        ("tech_interview", 9),
        ("final", 4),
        ("offer", 1),
    ]


def test_splits_the_drop_off_at_each_stage_as_the_design_flows(design: Funnel) -> None:
    assert [stage.drop_off for stage in design.stages] == [
        {"rejected": 21, "ghosted": 14, "withdrawn": 2},
        {"rejected": 5, "ghosted": 2, "withdrawn": 1},
        {"rejected": 4, "ghosted": 1, "withdrawn": 0},
        {"rejected": 2, "ghosted": 0, "withdrawn": 1},
        {"rejected": 0, "ghosted": 0, "withdrawn": 0},
    ]


def test_converts_each_stage_with_ghosted_left_out_of_the_trials(
    design: Funnel,
) -> None:
    rates = [
        rate
        for rate in (stage.conversion for stage in design.stages[:3])
        if isinstance(rate, Rate)
    ]

    assert [(rate.successes, rate.trials, rate.value) for rate in rates] == [
        (17, 40, 0.425),
        (9, 15, 0.6),
        (4, 8, 0.5),
    ]
    assert [bound for rate in rates for bound in (rate.low, rate.high)] == (
        pytest.approx(
            [
                0.2850939256,
                0.5780493146,
                0.3574683012,
                0.8017550386,
                0.2152160622,
                0.7847839378,
            ]
        )
    )
    assert [stage.conversion for stage in design.stages[3:]] == [
        Insufficient(have=4, need=1, message="Ще 1 відгук до першого висновку"),
        None,
    ]


def test_names_tech_interview_the_most_expensive_stage(design: Funnel) -> None:
    assert design.model_dump(by_alias=True)["mostExpensive"] == {
        "status": "ok",
        "stage": "tech_interview",
        "reached": 9,
        "passed": 4,
        "lost": 5,
        "investedDaysMedian": 17.0,
    }


def test_compares_august_with_july_in_the_kpi_header(design: Funnel) -> None:
    assert design.model_dump(by_alias=True)["kpis"] == {
        "sent": {"total": 54, "thisMonth": 19, "previousMonth": 15},
        "interviews": {"total": 9, "thisMonth": 5, "previousMonth": 3},
        "offers": {"total": 1, "thisMonth": 1, "previousMonth": 0},
        "daysInSearch": 84,
    }
