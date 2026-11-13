from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal, get_args

from app.core.enums import load_domain_enums
from app.metrics.funnel import FunnelStage
from app.metrics.ghost_market import GhostRateVsMarket
from app.metrics.most_expensive import MostExpensiveStage
from app.metrics.rate import Insufficient, MetricModel
from app.metrics.reasons import Reasons
from app.metrics.resume_ab import ResumeAb
from app.metrics.sources import Sources

type InsightBlock = Literal["funnel", "reasons", "sources", "resume_ab", "ghosted"]
type InsightSeverity = Literal["positive", "neutral", "warning"]


class Insight(MetricModel):
    block: InsightBlock
    title: str
    body: str
    severity: InsightSeverity
    evidence: dict[str, str | int | float]


class Insights(MetricModel):
    insights: list[Insight]


@dataclass(frozen=True)
class InsightMetrics:
    applications: int
    stages: list[FunnelStage]
    most_expensive: MostExpensiveStage | Insufficient | None
    reasons: Reasons
    sources: Sources
    resume_ab: ResumeAb
    ghosts: GhostRateVsMarket


type Rule = Callable[[InsightMetrics], Insight | None]

RULES: list[Rule] = []


def insight_rule(rule: Rule) -> Rule:
    RULES.append(rule)
    return rule


def insights(metrics: InsightMetrics) -> Insights:
    if metrics.applications < load_domain_enums().thresholds.min_n_insight:
        return Insights(insights=[])
    blocks: tuple[str, ...] = get_args(InsightBlock.__value__)
    found = [insight for rule in RULES if (insight := rule(metrics)) is not None]
    return Insights(
        insights=sorted(found, key=lambda insight: blocks.index(insight.block))
    )
