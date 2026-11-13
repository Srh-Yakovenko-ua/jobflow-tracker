from app.metrics.insights.engine import Insight, InsightMetrics, insight_rule
from app.metrics.insights.phrases import percent
from app.metrics.rate import Rate
from app.metrics.resume_ab import Verdict


@insight_rule
def resume_switch(metrics: InsightMetrics) -> Insight | None:
    comparison = metrics.resume_ab.comparison
    if comparison is None:
        return None
    verdict = comparison.verdict
    before, after = comparison.switch.before, comparison.switch.after
    if not isinstance(verdict, Verdict) or verdict.winner is None:
        return None
    if not isinstance(before, Rate) or not isinstance(after, Rate):
        return None
    falling = after.value < before.value
    moved = "впала" if falling else "виросла"
    shift = f"з {percent(before.value)}% до {percent(after.value)}%"
    return Insight(
        block="resume_ab",
        title=verdict.message,
        body=f"Після переходу на CV v{comparison.challenger} конверсія {moved} {shift}.",
        severity="warning" if falling else "positive",
        evidence={
            "challenger": comparison.challenger,
            "baseline": comparison.baseline,
            "beforePercent": percent(before.value),
            "afterPercent": percent(after.value),
        },
    )
