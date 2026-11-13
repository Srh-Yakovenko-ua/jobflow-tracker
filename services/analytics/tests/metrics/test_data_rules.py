from collections.abc import Callable

import pandas as pd
import pytest

from app.metrics.data_rules import (
    clean_events,
    conversion,
    ghost_rate,
    ghosted_application_ids,
)
from app.metrics.rate import Insufficient, Rate
from tests.factories import (
    StageEvent,
    application,
    stage_event,
    stage_events_frame,
)


def created(count: int) -> list[StageEvent]:
    return [stage_event(application(index), "applied") for index in range(count)]


def screened(count: int) -> list[StageEvent]:
    return [
        stage_event(application(index), "screening", from_stage="applied")
        for index in range(count)
    ]


SIX_APPLIED_THREE_SCREENED = [*created(6), *screened(3)]
TWO_GHOSTED = [
    stage_event(application(6), "applied"),
    stage_event(application(7), "applied"),
    stage_event(application(6), "screening", from_stage="applied"),
    stage_event(application(6), "ghosted", from_stage="screening"),
    stage_event(application(7), "ghosted", from_stage="applied"),
]
EIGHT_WITH_TWO_GHOSTED = [*SIX_APPLIED_THREE_SCREENED, *TWO_GHOSTED]


def ghosting_then(back: Callable[[StageEvent], StageEvent]) -> list[StageEvent]:
    ghosting = stage_event(application(0), "ghosted", from_stage="screening")
    return [*EIGHT_WITH_TWO_GHOSTED, ghosting, back(ghosting)]


def test_four_applications_answer_insufficient_with_one_more_needed() -> None:
    events = stage_events_frame(created(4))

    assert conversion(events, to_stage="screening") == Insufficient(
        have=4, need=1, message="Ще 1 відгук до першого висновку"
    )


def test_no_events_need_the_whole_percent_threshold() -> None:
    result = conversion(stage_events_frame([]), to_stage="screening")

    assert isinstance(result, Insufficient)
    assert result.need == 5


def test_ghosted_applications_do_not_change_the_conversion_rate() -> None:
    plain = conversion(
        stage_events_frame(SIX_APPLIED_THREE_SCREENED), to_stage="screening"
    )
    with_ghosted = conversion(
        stage_events_frame(EIGHT_WITH_TWO_GHOSTED), to_stage="screening"
    )

    assert plain == with_ghosted
    assert isinstance(with_ghosted, Rate)
    assert (with_ghosted.successes, with_ghosted.trials) == (3, 6)
    assert (with_ghosted.value, with_ghosted.low, with_ghosted.high) == pytest.approx(
        (0.5, 0.1876, 0.8124), abs=5e-5
    )


def test_ghosted_applications_are_counted_as_the_ghost_rate() -> None:
    result = ghost_rate(stage_events_frame(EIGHT_WITH_TWO_GHOSTED))

    assert isinstance(result, Rate)
    assert (result.successes, result.trials, result.value) == (2, 8, 0.25)


def test_a_rejection_followed_by_its_undo_changes_no_metric() -> None:
    rejection = stage_event(
        application(0), "rejected", from_stage="screening", reason="skills_gap"
    )
    undo = stage_event(
        application(0), "screening", from_stage="rejected", compensates=rejection.id
    )
    original = stage_events_frame(EIGHT_WITH_TWO_GHOSTED)
    undone = stage_events_frame([*EIGHT_WITH_TWO_GHOSTED, rejection, undo])

    pd.testing.assert_frame_equal(clean_events(undone), original)
    assert conversion(undone, to_stage="rejected") == conversion(
        original, to_stage="rejected"
    )
    assert ghost_rate(undone) == ghost_rate(original)


@pytest.mark.parametrize(
    "back",
    [
        lambda ghosting: stage_event(
            application(0),
            "screening",
            from_stage="ghosted",
            compensates=ghosting.id,
        ),
        lambda ghosting: stage_event(application(0), "screening", from_stage="ghosted"),
    ],
    ids=["undone", "revived"],
)
def test_a_ghosting_that_was_undone_or_revived_leaves_the_card_not_ghosted(
    back: Callable[[StageEvent], StageEvent],
) -> None:
    events = stage_events_frame(ghosting_then(back))

    assert ghosted_application_ids(events) == {application(6), application(7)}
