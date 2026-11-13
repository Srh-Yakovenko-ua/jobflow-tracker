from dataclasses import replace
from typing import Any
from uuid import uuid5

import pandas as pd
from hypothesis import event, example, given, settings
from hypothesis import strategies as st

from app.core.enums import GHOSTED_STAGE, load_domain_enums
from app.metrics.funnel import Funnel, funnel
from app.metrics.rate import Insufficient, Rate
from app.metrics.reasons import reasons
from app.metrics.sankey import sankey
from tests.factories import StageEvent, application, stage_event, stage_events_frame
from tests.metrics.funnel_design import DESIGN_NOW, DESIGN_PERIOD
from tests.metrics.journey_strategies import cohorts, ghosted_at_applied, undone_moves
from tests.metrics.sankey_fixtures import Journey, Move, reasoned_events, reasoned_frame

MIN_N_PERCENT = load_domain_enums().thresholds.min_n_percent
JUST_APPLIED: Journey = [("applied", None)]


def funnel_of(events: pd.DataFrame) -> Funnel:
    return funnel(events, period=DESIGN_PERIOD, now=DESIGN_NOW)


def dashboard(events: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        funnel_of(events).model_dump(by_alias=True),
        sankey(events, split="reason").model_dump(by_alias=True),
        reasons(events, stage=None, now=DESIGN_NOW).model_dump(by_alias=True),
    ]


def undo_pair(index: int, *, journey: Journey, move: Move) -> list[StageEvent]:
    key = application(index)
    last, _ = journey[-1]
    stage, reason = move
    done = stage_event(key, stage, from_stage=last, reason=reason)
    done = replace(done, id=uuid5(key, "undone-move"))
    return [done, stage_event(key, last, from_stage=stage, compensates=done.id)]


@settings(deadline=None, derandomize=True)
@given(applications=cohorts)
def test_the_funnel_never_grows(applications: list[Journey]) -> None:
    reached = [
        stage.reached for stage in funnel_of(reasoned_frame(applications)).stages
    ]

    assert reached == sorted(reached, reverse=True)


@settings(deadline=None, derandomize=True)
@given(applications=cohorts)
def test_every_rated_conversion_stays_between_zero_and_one(
    applications: list[Journey],
) -> None:
    for stage in funnel_of(reasoned_frame(applications)).stages:
        if isinstance(stage.conversion, Rate):
            bounds = (
                stage.conversion.value,
                stage.conversion.low,
                stage.conversion.high,
            )
            assert all(0 <= bound <= 1 for bound in bounds)


@settings(deadline=None, derandomize=True)
@given(
    applications=cohorts,
    ghosted=st.lists(ghosted_at_applied, min_size=1, max_size=30),
)
def test_ghosted_applications_stay_out_of_every_conversion(
    applications: list[Journey], ghosted: list[Journey]
) -> None:
    alone = funnel_of(reasoned_frame(applications))
    with_ghosts = funnel_of(reasoned_frame([*applications, *ghosted]))

    assert with_ghosts.stages[0].reached == alone.stages[0].reached + len(ghosted)
    assert [stage.conversion for stage in with_ghosts.stages] == [
        stage.conversion for stage in alone.stages
    ]


@settings(deadline=None, derandomize=True)
@given(applications=cohorts)
@example(applications=[JUST_APPLIED] * (MIN_N_PERCENT - 1))
@example(applications=[JUST_APPLIED] * MIN_N_PERCENT)
def test_a_conversion_is_insufficient_exactly_below_the_percent_threshold(
    applications: list[Journey],
) -> None:
    for stage in funnel_of(reasoned_frame(applications)).stages[:-1]:
        trials = stage.reached - stage.drop_off[GHOSTED_STAGE]
        short = isinstance(stage.conversion, Insufficient)
        event("insufficient" if short else "rated")
        assert short == (trials < MIN_N_PERCENT)


@settings(deadline=None, derandomize=True)
@given(applications=cohorts, undone=undone_moves)
def test_an_undone_move_leaves_funnel_sankey_and_reasons_unchanged(
    applications: list[Journey], undone: list[Move]
) -> None:
    events = reasoned_events(applications)
    pairs = [
        row
        for index, move in enumerate(undone[: len(applications)])
        for row in undo_pair(index, journey=applications[index], move=move)
    ]

    assert dashboard(stage_events_frame([*events, *pairs])) == dashboard(
        stage_events_frame(events)
    )
