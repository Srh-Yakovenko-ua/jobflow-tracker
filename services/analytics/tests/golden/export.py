import json
from collections.abc import Callable
from pathlib import Path
from typing import Any, Final

import pandas as pd
from loguru import logger
from pydantic import BaseModel

from app.metrics.forecast import WhatIf, forecast
from app.metrics.funnel import funnel
from app.metrics.insights.engine import insights
from app.metrics.insights.inputs import insight_metrics
from app.metrics.norms import norms
from app.metrics.reasons import reasons
from app.metrics.reasons_summary import reasons_summary
from app.metrics.resume_ab import resume_ab
from app.metrics.sankey import sankey
from app.metrics.sources import sources
from app.metrics.timings import timings
from tests.golden.story import Story, design_story

STORY_FILE: Final = Path(__file__).with_name("design_story.json")
SNAPSHOTS_FILE: Final = Path(__file__).with_name("snapshots.json")

METRICS: Final[dict[str, Callable[[Story], BaseModel]]] = {
    "funnel": lambda story: funnel(story.events, period=story.period, now=story.now),
    "sankey": lambda story: sankey(story.events, split=None),
    "reasons": lambda story: reasons(story.events, stage=None, now=story.now),
    "reasons_summary": lambda story: reasons_summary(
        story.events, stage="tech_interview"
    ),
    "sources": lambda story: sources(story.events, origins=story.origins),
    "timings": lambda story: timings(story.events, followups=story.followups),
    "norms": lambda story: norms(story.events),
    "resume_ab": lambda story: resume_ab(story.events, links=story.links),
    "forecast": lambda story: forecast(story.events, now=story.now, what_if=WhatIf()),
    "insights": lambda story: insights(
        insight_metrics(
            story.events, origins=story.origins, links=story.links, now=story.now
        )
    ),
}


SNAPSHOT_DECIMALS: Final = 10


def rounded(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, SNAPSHOT_DECIMALS)
    if isinstance(value, dict):
        return {key: rounded(item) for key, item in value.items()}
    if isinstance(value, list):
        return [rounded(item) for item in value]
    return value


def metric_body(story: Story, *, name: str) -> Any:
    return rounded(METRICS[name](story).model_dump(by_alias=True, mode="json"))


def iso(moment: Any) -> str:
    return pd.Timestamp(moment).isoformat().replace("+00:00", "Z")


def text_or_none(value: object) -> str | None:
    return value if isinstance(value, str) else None


def events_json(events: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {
            "fromStage": text_or_none(event.from_stage),
            "toStage": event.to_stage,
            "reasonCode": text_or_none(event.reason_code),
            "occurredAt": iso(event.occurred_at),
        }
        for event in events.itertuples()
    ]


def applications_json(story: Story) -> list[dict[str, Any]]:
    events = dict(tuple(story.events.groupby("application_id", sort=False)))
    origins = story.origins.to_dict("records")
    rows = zip(origins, story.links.to_dict("records"), strict=True)
    return [
        {
            "key": f"application-{index}",
            "source": origin["source"],
            "url": origin["url"],
            "resumeVersion": int(link["number"]),
            "events": events_json(events[origin["application_id"]]),
        }
        for index, (origin, link) in enumerate(rows)
    ]


def story_json(story: Story) -> dict[str, Any]:
    versions = story.links[["number", "title"]].drop_duplicates().sort_values("number")
    return {
        "now": iso(story.now),
        "searchStartedAt": iso(story.period.started_at),
        "timezone": story.period.timezone,
        "resumeVersions": [
            {"number": int(number), "title": str(title)}
            for number, title in versions.itertuples(index=False)
        ],
        "applications": applications_json(story),
    }


def json_text(data: Any) -> str:
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main() -> None:
    story = design_story()
    STORY_FILE.write_text(json_text(story_json(story)), encoding="utf-8")
    bodies = {name: metric_body(story, name=name) for name in METRICS}
    SNAPSHOTS_FILE.write_text(json_text(bodies), encoding="utf-8")
    for path in (STORY_FILE, SNAPSHOTS_FILE):
        logger.info("wrote {path}", path=path.name)


if __name__ == "__main__":
    main()
