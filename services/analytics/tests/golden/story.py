from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from itertools import cycle
from typing import Final, NamedTuple

import numpy as np
import pandas as pd

from app.core.enums import (
    GHOSTED_STAGE,
    REJECTED_STAGE,
    load_domain_enums,
    reason_codes,
)
from app.metrics.kpis import SearchPeriod
from scripts.backtest_forecast import START, journey
from tests.factories import (
    ApplicationSource,
    VersionLink,
    application,
    application_sources_frame,
    followups_frame,
    stage_events_frame,
    version_links_frame,
)
from tests.golden.design_tags import DESIGN_TAGS, TECH_INTERVIEW_REASONS, url_of
from tests.metrics import funnel_design
from tests.metrics.resume_ab_design import TITLES, resume_version
from tests.metrics.sankey_fixtures import reasoned_events

ENDING_SHARES: Final = {REJECTED_STAGE: 0.6, GHOSTED_STAGE: 0.3, "withdrawn": 0.1}
SEARCH_DAYS: Final = 84
TIMEZONE: Final = "Europe/Kyiv"

type DatedStep = tuple[str, str | None, datetime]


class Tags(NamedTuple):
    source: str
    url: str | None
    version: int


class Draft(NamedTuple):
    steps: list[DatedStep]
    tags: Tags


@dataclass(frozen=True)
class Story:
    events: pd.DataFrame
    origins: pd.DataFrame
    links: pd.DataFrame
    followups: pd.DataFrame
    now: datetime
    period: SearchPeriod


def story_of(drafts: list[Draft], *, now: datetime, period: SearchPeriod) -> Story:
    paths = [[(stage, reason) for stage, reason, _ in draft.steps] for draft in drafts]
    tags = [(application(index), draft.tags) for index, draft in enumerate(drafts)]
    return Story(
        events=stage_events_frame(
            reasoned_events(paths),
            occurred_at=[moment for draft in drafts for *_, moment in draft.steps],
        ),
        origins=application_sources_frame(
            [ApplicationSource(key, tag.source, tag.url) for key, tag in tags]
        ),
        links=version_links_frame(
            [
                VersionLink(
                    key, resume_version(tag.version), tag.version, TITLES[tag.version]
                )
                for key, tag in tags
            ]
        ),
        followups=followups_frame([]),
        now=now,
        period=period,
    )


def rejection_reasons() -> Callable[[str], str]:
    by_stage = {"tech_interview": iter(TECH_INTERVIEW_REASONS)}
    others = cycle(reason_codes())
    return lambda stage: next(by_stage.get(stage, others))


def design_drafts() -> list[Draft]:
    reason_at = rejection_reasons()
    drafts: list[Draft] = []
    for flow, cohorts in zip(funnel_design.DESIGN_FLOWS, DESIGN_TAGS, strict=True):
        *moves, (outcome, ended) = funnel_design.journey(flow)
        for tagged in [tag for tag in cohorts for _ in range(tag.size)]:
            reason = reason_at(flow[0][-1]) if outcome == REJECTED_STAGE else None
            url = url_of(tagged, number=len(drafts))
            drafts.append(
                Draft(
                    [
                        *((stage, None, at) for stage, at in moves),
                        (outcome, reason, ended),
                    ],
                    Tags(tagged.source, url, tagged.version),
                )
            )
    return drafts


def design_story() -> Story:
    return story_of(
        design_drafts(),
        now=funnel_design.DESIGN_NOW,
        period=funnel_design.DESIGN_PERIOD,
    )


def random_steps(rng: np.random.Generator, *, start: float) -> list[DatedStep]:
    *moves, (last, moment) = journey(rng, start=start)
    ending = last
    if last == REJECTED_STAGE:
        ending = str(rng.choice(list(ENDING_SHARES), p=list(ENDING_SHARES.values())))
    reason = str(rng.choice(reason_codes())) if ending == REJECTED_STAGE else None
    steps = [*((stage, None, at) for stage, at in moves), (ending, reason, moment)]
    return [(stage, why, START + timedelta(days=at)) for stage, why, at in steps]


def random_draft(rng: np.random.Generator, *, start: float) -> Draft:
    steps = random_steps(rng, start=start)
    source = str(rng.choice(load_domain_enums().sources))
    return Draft(steps, Tags(source, None, int(rng.integers(1, 4))))


def random_story(*, seed: int, applications: int) -> Story:
    rng = np.random.default_rng(seed)
    starts = np.sort(rng.uniform(0, SEARCH_DAYS, applications))
    drafts = [random_draft(rng, start=float(start)) for start in starts]
    ended = max((step[2] for draft in drafts for step in draft.steps), default=START)
    return story_of(
        drafts,
        now=ended + timedelta(days=1),
        period=SearchPeriod(started_at=START, timezone=TIMEZONE),
    )
