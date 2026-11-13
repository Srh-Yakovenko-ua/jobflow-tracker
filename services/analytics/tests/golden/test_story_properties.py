from collections.abc import Iterator
from typing import Any

from hypothesis import given, settings
from hypothesis import strategies as st

from app.metrics.funnel import funnel
from tests.golden.export import metric_body
from tests.golden.story import Story, design_story, random_story
from tests.metrics.funnel_design import DESIGN_NOW, DESIGN_PERIOD, design_frame

RATE_KEYS = {"status", "value", "low", "high", "successes", "trials"}
RATED_METRICS = ("funnel", "sources", "resume_ab", "reasons")

stories = st.builds(
    random_story,
    seed=st.integers(min_value=0, max_value=2**32 - 1),
    applications=st.integers(min_value=0, max_value=120),
)


def rates(node: Any) -> Iterator[dict[str, Any]]:
    if isinstance(node, dict):
        if RATE_KEYS <= node.keys():
            yield node
        nested: list[Any] = list(node.values())
    else:
        nested = node if isinstance(node, list) else []
    for child in nested:
        yield from rates(child)


@settings(deadline=None, derandomize=True)
@given(story=stories)
def test_every_rate_on_the_dashboard_stays_between_zero_and_one(story: Story) -> None:
    bodies = [metric_body(story, name=name) for name in RATED_METRICS]

    for found in rates(bodies):
        assert all(0 <= found[key] <= 1 for key in ("value", "low", "high"))


@settings(deadline=None, derandomize=True)
@given(story=stories)
def test_every_stage_passes_drops_or_keeps_each_application_it_reached(
    story: Story,
) -> None:
    still_open = story.events.groupby("application_id")["to_stage"].last()

    for stage in funnel(story.events, period=story.period, now=story.now).stages:
        kept = int((still_open == stage.stage).sum())
        moved_on = stage.passed or 0
        assert stage.reached == moved_on + sum(stage.drop_off.values()) + kept


def test_reasons_sources_and_versions_leave_the_design_funnel_as_drawn() -> None:
    story = design_story()

    assert funnel(story.events, period=story.period, now=story.now) == funnel(
        design_frame(), period=DESIGN_PERIOD, now=DESIGN_NOW
    )
