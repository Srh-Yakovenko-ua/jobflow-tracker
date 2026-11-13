import pytest

from app.metrics.funnel import FunnelStage
from app.metrics.rate import rate
from app.metrics.source_ranking import note, pooled_share, rank

SMALL_BUT_CLEAR = "вибірка мала, але напрям однозначний"
DESIGN_POOL = 0.34


def first_stage(applications: int, screenings: int, *, ghosted: int = 0) -> FunnelStage:
    return FunnelStage(
        stage="applied",
        reached=applications,
        passed=screenings,
        conversion=rate(screenings, applications - ghosted),
        drop_off={
            "rejected": applications - screenings - ghosted,
            "ghosted": ghosted,
            "withdrawn": 0,
        },
    )


DESIGN_STAGES = {
    "djinni": first_stage(24, 9, ghosted=2),
    "dou": first_stage(11, 2),
    "linkedin": first_stage(16, 2, ghosted=4),
    "referral": first_stage(3, 3),
    "company_site": first_stage(2, 1),
}


def test_pools_the_conversion_of_every_source_in_the_scope() -> None:
    assert pooled_share(DESIGN_STAGES.values()) == DESIGN_POOL


def test_pools_nothing_when_no_application_could_convert() -> None:
    assert pooled_share([first_stage(2, 0, ghosted=2)]) == 0.0


def test_marks_three_referrals_out_of_three_as_small_but_clear() -> None:
    assert note(first_stage(3, 3), pooled=DESIGN_POOL) == SMALL_BUT_CLEAR


@pytest.mark.parametrize(
    ("stage", "pooled"),
    [
        (first_stage(2, 1), DESIGN_POOL),
        (first_stage(4, 0), DESIGN_POOL),
        (first_stage(24, 9, ghosted=2), 0.9),
        (first_stage(2, 0, ghosted=2), DESIGN_POOL),
    ],
    ids=["one of two", "none of four", "ranked sample", "no trials"],
)
def test_leaves_a_sample_unmarked_when_its_direction_is_noise(
    stage: FunnelStage, *, pooled: float
) -> None:
    assert note(stage, pooled=pooled) is None


def test_marks_a_small_sample_wholly_below_the_pool() -> None:
    assert note(first_stage(4, 0), pooled=0.6) == SMALL_BUT_CLEAR


def test_ranks_the_design_sources_with_the_small_samples_after_the_rest() -> None:
    assert rank(DESIGN_STAGES) == [
        "djinni",
        "dou",
        "linkedin",
        "referral",
        "company_site",
    ]


def test_three_out_of_three_never_outranks_a_source_with_enough_trials() -> None:
    stages = {"referral": first_stage(3, 3), "dou": first_stage(5, 0)}

    assert rank(stages) == ["dou", "referral"]


def test_breaks_a_tie_by_applications_then_by_the_source_order() -> None:
    stages = {
        "dou": first_stage(10, 2),
        "djinni": first_stage(10, 2),
        "linkedin": first_stage(12, 2, ghosted=2),
    }

    assert rank(stages) == ["linkedin", "djinni", "dou"]


def test_puts_a_source_without_trials_last() -> None:
    stages = {
        "referral": first_stage(2, 0, ghosted=2),
        "company_site": first_stage(1, 0),
    }

    assert rank(stages) == ["company_site", "referral"]
