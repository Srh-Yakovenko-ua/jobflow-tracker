from collections.abc import Callable
from dataclasses import dataclass
from typing import Final, Literal, get_args

from app.core.enums import load_domain_enums
from app.metrics.forecast import Forecast
from app.metrics.funnel import FunnelStage
from app.metrics.ghost_market import GhostRateVsMarket
from app.metrics.most_expensive import MostExpensiveStage
from app.metrics.rate import Insufficient, MetricModel
from app.metrics.reasons import Reasons
from app.metrics.resume_ab import ResumeAb
from app.metrics.sources import Sources

type InsightBlock = Literal["funnel", "reasons", "sources", "resume_ab", "ghosted"]
type InsightSeverity = Literal["positive", "neutral", "warning"]

MAX_ACTIONS: Final = 4
WHAT_IF_CONVERSION: Final = 0.6


class Insight(MetricModel):
    block: InsightBlock
    title: str
    body: str
    severity: InsightSeverity
    evidence: dict[str, str | int | float]


class InsightAction(MetricModel):
    block: InsightBlock
    title: str
    expected_effect: str


class Insights(MetricModel):
    insights: list[Insight]
    actions: list[InsightAction]


@dataclass(frozen=True)
class InsightMetrics:
    applications: int
    stages: list[FunnelStage]
    most_expensive: MostExpensiveStage | Insufficient | None
    reasons: Reasons
    sources: Sources
    resume_ab: ResumeAb
    ghosts: GhostRateVsMarket
    stage_what_if: Forecast | Insufficient | None = None


type Rule = Callable[[InsightMetrics], Insight | None]
type ActionRule = Callable[[InsightMetrics], InsightAction | None]

RULES: list[Rule] = []
ACTION_RULES: list[ActionRule] = []


def insight_rule(rule: Rule) -> Rule:
    RULES.append(rule)
    return rule


def action_rule(rule: ActionRule) -> ActionRule:
    ACTION_RULES.append(rule)
    return rule


def in_block_order[Said: (Insight, InsightAction)](found: list[Said]) -> list[Said]:
    blocks: tuple[str, ...] = get_args(InsightBlock.__value__)
    return sorted(found, key=lambda said: blocks.index(said.block))


def insights(metrics: InsightMetrics) -> Insights:
    if metrics.applications < load_domain_enums().thresholds.min_n_insight:
        return Insights(insights=[], actions=[])
    found = [insight for rule in RULES if (insight := rule(metrics)) is not None]
    advised = [action for rule in ACTION_RULES if (action := rule(metrics)) is not None]
    return Insights(
        insights=in_block_order(found),
        actions=in_block_order(advised)[:MAX_ACTIONS],
    )
