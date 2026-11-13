from typing import NamedTuple

from app.metrics.insights.engine import (
    Insight,
    InsightAction,
    InsightMetrics,
    action_rule,
    insight_rule,
)
from app.metrics.insights.phrases import percent
from app.metrics.rate import Rate
from app.metrics.resume_ab import ResumeAbComparison, Verdict


class MeasuredSwitch(NamedTuple):
    comparison: ResumeAbComparison
    verdict: Verdict
    before: Rate
    after: Rate


def measured_switch(metrics: InsightMetrics) -> MeasuredSwitch | None:
    comparison = metrics.resume_ab.comparison
    if comparison is None:
        return None
    verdict = comparison.verdict
    before, after = comparison.switch.before, comparison.switch.after
    if not isinstance(verdict, Verdict) or verdict.winner is None:
        return None
    if not isinstance(before, Rate) or not isinstance(after, Rate):
        return None
    if verdict.winner != comparison.challenger:
        return None
    if percent(after.value) <= percent(before.value):
        return None
    return MeasuredSwitch(comparison, verdict, before, after)


@insight_rule
def resume_switch(metrics: InsightMetrics) -> Insight | None:
    measured = measured_switch(metrics)
    if measured is None:
        return None
    comparison, verdict, before, after = measured
    shift = f"з {percent(before.value)}% до {percent(after.value)}%"
    return Insight(
        block="resume_ab",
        title=verdict.message,
        body=f"Після переходу на CV v{comparison.challenger} конверсія виросла {shift}.",
        severity="positive",
        evidence={
            "challenger": comparison.challenger,
            "baseline": comparison.baseline,
            "beforePercent": percent(before.value),
            "afterPercent": percent(after.value),
        },
    )


@action_rule
def keep_winning_resume(metrics: InsightMetrics) -> InsightAction | None:
    measured = measured_switch(metrics)
    if measured is None:
        return None
    comparison, _, before, after = measured
    winner = comparison.challenger
    return InsightAction(
        block="resume_ab",
        title=f"Відгукуватися з CV v{winner}",
        expected_effect=f"Конверсія у скринінг {percent(after.value)}% проти "
        f"{percent(before.value)}% до переходу на CV v{winner}.",
    )
