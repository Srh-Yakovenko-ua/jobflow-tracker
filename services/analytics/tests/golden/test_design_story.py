import json
from dataclasses import replace
from typing import Any
from uuid import UUID

import pytest

from app.core.enums import REJECTED_STAGE, progress_stages
from tests.golden.export import (
    METRICS,
    SNAPSHOTS_FILE,
    STORY_FILE,
    metric_body,
    story_json,
)
from tests.golden.story import Story, design_story


@pytest.fixture(scope="module")
def story() -> Story:
    return design_story()


def committed(path_name: str) -> Any:
    path = {"story": STORY_FILE, "snapshots": SNAPSHOTS_FILE}[path_name]
    return json.loads(path.read_text(encoding="utf-8"))


def test_the_design_story_ends_as_the_mockups_count(story: Story) -> None:
    endings = story.events.groupby("application_id")["to_stage"].last()

    assert endings.value_counts().to_dict() == {
        "rejected": 32,
        "ghosted": 17,
        "withdrawn": 4,
        "offer": 1,
    }


def test_the_design_story_reaches_each_stage_as_the_funnel_mockup(
    story: Story,
) -> None:
    reached = story.events.groupby("to_stage")["application_id"].nunique()

    assert [int(reached[stage]) for stage in progress_stages()] == [54, 17, 9, 4, 1]


def test_three_of_four_tech_interview_rejections_name_a_skills_gap(
    story: Story,
) -> None:
    events = story.events
    at_tech_interview = events[
        (events["to_stage"] == REJECTED_STAGE)
        & (events["from_stage"] == "tech_interview")
    ]

    assert at_tech_interview["reason_code"].value_counts().to_dict() == {
        "skills_gap": 3,
        "english_level": 1,
    }


def test_every_application_carries_a_source_a_url_and_a_cv_version(
    story: Story,
) -> None:
    assert len(story.origins) == len(story.links) == 54
    assert story.origins["url"].notna().all()
    assert story.links["number"].value_counts().sort_index().to_dict() == {
        1: 21,
        2: 27,
        3: 6,
    }


@pytest.mark.parametrize("name", list(METRICS), ids=list(METRICS))
def test_the_metric_on_the_design_story_matches_its_snapshot(
    story: Story, name: str
) -> None:
    assert metric_body(story, name=name) == committed("snapshots")[name]


def test_the_forecast_ignores_which_ids_simultaneous_events_carry(story: Story) -> None:
    inserted = story.events.assign(
        id=[UUID(int=order) for order in range(len(story.events))]
    )

    assert (
        metric_body(replace(story, events=inserted), name="forecast")
        == committed("snapshots")["forecast"]
    )


def test_the_committed_story_export_matches_the_builder(story: Story) -> None:
    assert committed("story") == story_json(story)
