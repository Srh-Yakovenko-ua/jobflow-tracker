import pandas as pd
from hypothesis import assume, given, settings
from hypothesis import strategies as st

from app.core.enums import load_domain_enums
from app.metrics.data_rules import clean_events
from app.metrics.stage_timing import (
    StageShortfall,
    StageTiming,
    stage_norms,
    stage_stays,
    stage_timings,
)
from tests.factories import application, day, stage_event, stage_events_frame
from tests.metrics.sankey_fixtures import DatedMove, dated_frame

SENT: DatedMove = ("applied", None, 0)


def stays_of(paths: list[list[DatedMove]]) -> list[tuple[str, float]]:
    stays = stage_stays(clean_events(dated_frame(paths)))
    return sorted(zip(stays["stage"], stays["days"], strict=True))


def stays_frame(days: dict[str, list[float]]) -> pd.DataFrame:
    rows = [(stage, length) for stage, lengths in days.items() for length in lengths]
    return pd.DataFrame(rows, columns=["stage", "days"])


def test_a_stage_lasts_until_the_next_event_of_the_same_application() -> None:
    assert stays_of(
        [
            [SENT, ("screening", None, 3), ("rejected", "skills_gap", 5.5)],
            [SENT, ("rejected", "no_explanation", 2)],
        ]
    ) == [("applied", 2.0), ("applied", 3.0), ("screening", 2.5)]


def test_leaves_out_a_stay_ended_by_ghosting_and_the_open_current_stay() -> None:
    assert stays_of(
        [
            [SENT, ("ghosted", None, 21)],
            [SENT, ("screening", None, 4)],
            [SENT],
        ]
    ) == [("applied", 4.0)]


def test_counts_each_tech_interview_round_as_its_own_stay() -> None:
    assert stays_of(
        [
            [
                SENT,
                ("tech_interview", None, 5),
                ("tech_interview", None, 9),
                ("final", None, 12),
                ("offer", None, 20),
            ]
        ]
    ) == [
        ("applied", 5.0),
        ("final", 8.0),
        ("tech_interview", 3.0),
        ("tech_interview", 4.0),
    ]


def test_drops_a_compensated_move_and_its_undo_from_the_stays() -> None:
    sent = stage_event(application(0), "applied")
    undone = stage_event(application(0), "screening", from_stage="applied")
    undo = stage_event(
        application(0), "applied", from_stage="screening", compensates=undone.id
    )
    redone = stage_event(application(0), "tech_interview", from_stage="applied")
    frame = stage_events_frame(
        [sent, undone, undo, redone], occurred_at=[day(0), day(3), day(4), day(8)]
    )

    stays = stage_stays(clean_events(frame))

    assert list(zip(stays["stage"], stays["days"], strict=True)) == [("applied", 8.0)]


def test_hides_a_stage_below_five_stays_and_shows_it_at_five() -> None:
    stays = stays_frame({"applied": [1, 2, 3, 4, 10], "screening": [2, 2, 3, 9]})

    timings = stage_timings(stays)

    assert timings == [
        StageTiming(
            stage="applied",
            median_days=3.0,
            lower_quartile_days=2.0,
            upper_quartile_days=4.0,
            samples=5,
        ),
        StageShortfall(
            stage="screening", have=4, need=1, message="Ще 1 відгук до першого висновку"
        ),
        StageShortfall(
            stage="tech_interview",
            have=0,
            need=5,
            message="Ще 5 відгуків до першого висновку",
        ),
        StageShortfall(
            stage="final", have=0, need=5, message="Ще 5 відгуків до першого висновку"
        ),
    ]
    assert stage_norms(stays) == {
        "applied": 3,
        "screening": None,
        "tech_interview": None,
        "final": None,
    }


def test_rounds_a_half_day_norm_up_to_the_next_whole_day() -> None:
    stays = stays_frame({"final": [16, 16.5, 16.5, 17, 18], "applied": [2] * 6})

    assert stage_norms(stays) == {
        "applied": 2,
        "screening": None,
        "tech_interview": None,
        "final": 17,
    }


stay_lengths = st.lists(
    st.floats(min_value=0, max_value=90, allow_nan=False), max_size=9
)


@settings(deadline=None, derandomize=True)
@given(
    days=st.fixed_dictionaries(
        {stage: stay_lengths for stage in load_domain_enums().active_stages}
    )
)
def test_a_norm_shows_exactly_when_its_stage_has_five_stays(
    days: dict[str, list[float]],
) -> None:
    assume(len({len(lengths) >= 5 for lengths in days.values()}) == 2)
    stays = stays_frame(days)

    norms = stage_norms(stays)
    shown = {stage for stage, norm in norms.items() if norm is not None}

    assert shown == {stage for stage, lengths in days.items() if len(lengths) >= 5}
    assert {norm is None for norm in norms.values()} == {True, False}
    assert [
        timing.stage
        for timing in stage_timings(stays)
        if isinstance(timing, StageTiming)
    ] == [stage for stage in norms if stage in shown]
