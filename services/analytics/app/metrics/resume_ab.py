from datetime import datetime
from typing import Annotated, Final, Literal, NamedTuple
from uuid import UUID

import pandas as pd
from pydantic import Field

from app.core.enums import load_domain_enums
from app.metrics.data_rules import clean_events
from app.metrics.funnel import FunnelStage, funnel_stage
from app.metrics.journeys import journeys
from app.metrics.proportions import (
    AB_RULES,
    Counts,
    ProportionTestName,
    probability_better,
    proportion_test,
    share,
)
from app.metrics.rate import (
    Insufficient,
    MetricModel,
    Rate,
    RateResult,
    insufficient,
    rate,
)
from app.metrics.source_ranking import conversion_counts

LINK_COLUMNS: Final = ["resume_version_id", "number", "title"]


class ResumeAbVersion(MetricModel):
    resume_version_id: UUID
    number: int
    title: str
    applications: int
    screenings: int
    conversion: RateResult


class Verdict(MetricModel):
    status: Literal["ok"] = "ok"
    winner: int | None
    message: str


type VerdictResult = Annotated[Verdict | Insufficient, Field(discriminator="status")]


class ResumeSwitch(MetricModel):
    at: datetime
    before: RateResult
    after: RateResult


class ResumeAbComparison(MetricModel):
    challenger: int
    baseline: int
    difference: float
    test: ProportionTestName
    p_value: float
    probability_better: float
    verdict: VerdictResult
    switch: ResumeSwitch


class ResumeAb(MetricModel):
    versions: list[ResumeAbVersion]
    comparison: ResumeAbComparison | None


class Pair(NamedTuple):
    challenger: int
    baseline: int


def stage_conversion(stage: FunnelStage) -> Rate | Insufficient:
    return stage.conversion or rate(*conversion_counts(stage))


def version_row(group: pd.DataFrame, *, stage: FunnelStage) -> ResumeAbVersion:
    first = group.iloc[0]
    return ResumeAbVersion(
        resume_version_id=first["resume_version_id"],
        number=int(first["number"]),
        title=str(first["title"]),
        applications=stage.reached,
        screenings=conversion_counts(stage)[0],
        conversion=stage_conversion(stage),
    )


def compared_pair(stages: dict[int, FunnelStage]) -> Pair | None:
    most_used = sorted(stages, key=lambda number: (stages[number].reached, number))
    if len(most_used) < 2:
        return None
    return Pair(challenger=max(most_used[-2:]), baseline=min(most_used[-2:]))


def verdict(pair: Pair, *, fewest: int, probability: float) -> Verdict | Insufficient:
    thresholds = load_domain_enums().thresholds
    short = insufficient(fewest, threshold=thresholds.min_n_insight)
    if short is not None:
        return short
    leads = probability >= 1 / 2
    leader = pair.challenger if leads else pair.baseline
    belief = probability if leads else 1 - probability
    if belief >= AB_RULES.clear:
        return Verdict(winner=leader, message=f"CV v{leader} працює краще")
    if belief >= AB_RULES.likely:
        return Verdict(winner=leader, message=f"Схоже, CV v{leader} працює краще")
    message = f"Різниці між CV v{pair.challenger} і CV v{pair.baseline} поки не видно"
    return Verdict(winner=None, message=message)


def switch(rows: pd.DataFrame, *, pair: Pair) -> ResumeSwitch:
    pair_rows = rows[rows["number"].isin(pair)]
    started = pair_rows["started_at"]
    at = pd.Timestamp(started[pair_rows["number"] == pair.challenger].min())
    return ResumeSwitch(
        at=at.to_pydatetime(),
        before=stage_conversion(funnel_stage(pair_rows[started < at], index=0)),
        after=stage_conversion(funnel_stage(pair_rows[started >= at], index=0)),
    )


def comparison(
    rows: pd.DataFrame, *, stages: dict[int, FunnelStage], pair: Pair
) -> ResumeAbComparison:
    ahead = Counts(*conversion_counts(stages[pair.challenger]))
    behind = Counts(*conversion_counts(stages[pair.baseline]))
    tested = proportion_test(ahead, behind)
    probability = probability_better(ahead, behind)
    fewest = min(ahead.trials, behind.trials)
    return ResumeAbComparison(
        challenger=pair.challenger,
        baseline=pair.baseline,
        difference=share(ahead) - share(behind),
        test=tested.name,
        p_value=tested.p_value,
        probability_better=probability,
        verdict=verdict(pair, fewest=fewest, probability=probability),
        switch=switch(rows, pair=pair),
    )


def resume_ab(events: pd.DataFrame, *, links: pd.DataFrame) -> ResumeAb:
    tags = links.set_index("application_id")[LINK_COLUMNS]
    rows = journeys(clean_events(events)).join(tags, how="inner")
    numbers = sorted(map(int, rows["number"].unique()), reverse=True)
    groups = {number: rows[rows["number"] == number] for number in numbers}
    stages = {number: funnel_stage(group, index=0) for number, group in groups.items()}
    pair = compared_pair(stages)
    return ResumeAb(
        versions=[
            version_row(groups[number], stage=stages[number]) for number in numbers
        ],
        comparison=None if pair is None else comparison(rows, stages=stages, pair=pair),
    )
