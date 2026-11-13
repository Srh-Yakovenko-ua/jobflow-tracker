from typing import Final

import pandas as pd

from app.core.enums import GHOSTED_STAGE, LINKEDIN_SOURCE, load_domain_enums
from app.metrics.data_rules import clean_events, ghost_rate
from app.metrics.funnel import FunnelStage, funnel_stage
from app.metrics.journeys import ended_at, journeys
from app.metrics.rate import MetricModel, RateResult, rate
from app.metrics.response_time import (
    ResponseTimeResult,
    median_response,
    response_days,
)
from app.metrics.source_ranking import conversion_counts, note, pooled_share, rank

EASY_APPLY_URL: Final = r"linkedin\.com/jobs/view/\d+/apply"


class SourcePerformance(MetricModel):
    source: str
    applications: int
    screenings: int
    easy_apply: int
    conversion: RateResult
    ghost_rate: RateResult
    median_response: ResponseTimeResult
    note: str | None


class SilentGhosts(MetricModel):
    total: int
    easy_apply: int


class Sources(MetricModel):
    sources: list[SourcePerformance]
    silent_ghosts: SilentGhosts


def tagged_journeys(clean: pd.DataFrame, *, origins: pd.DataFrame) -> pd.DataFrame:
    urls = origins["url"].astype("string")
    is_linkedin = origins["source"] == LINKEDIN_SOURCE
    easy_apply = is_linkedin & urls.str.contains(EASY_APPLY_URL, na=False)
    tags = origins.assign(is_easy_apply=easy_apply).set_index("application_id")
    rows = journeys(clean).join(tags[["source", "is_easy_apply"]], how="inner")
    return rows.assign(reply_days=response_days(clean, started_at=rows["started_at"]))


def performance(
    group: pd.DataFrame, *, stage: FunnelStage, clean: pd.DataFrame, pooled: float
) -> SourcePerformance:
    successes, trials = conversion_counts(stage)
    own_events = clean[clean["application_id"].isin(group.index)]
    return SourcePerformance(
        source=str(group["source"].iat[0]),
        applications=stage.reached,
        screenings=successes,
        easy_apply=int(group["is_easy_apply"].sum()),
        conversion=stage.conversion or rate(successes, trials),
        ghost_rate=ghost_rate(own_events),
        median_response=median_response(group["reply_days"].dropna()),
        note=note(stage, pooled=pooled),
    )


def silent_ghosts(rows: pd.DataFrame) -> SilentGhosts:
    ended = ended_at(rows, index=0)
    silent = ended[ended["outcome"] == GHOSTED_STAGE]
    return SilentGhosts(
        total=len(silent), easy_apply=int(silent["is_easy_apply"].sum())
    )


def sources(events: pd.DataFrame, *, origins: pd.DataFrame) -> Sources:
    clean = clean_events(events)
    rows = tagged_journeys(clean, origins=origins)
    groups = {
        source: rows[rows["source"] == source]
        for source in load_domain_enums().sources
        if (rows["source"] == source).any()
    }
    stages = {source: funnel_stage(group, index=0) for source, group in groups.items()}
    pooled = pooled_share(stages.values())
    return Sources(
        sources=[
            performance(
                groups[source], stage=stages[source], clean=clean, pooled=pooled
            )
            for source in rank(stages)
        ],
        silent_ghosts=silent_ghosts(rows),
    )
