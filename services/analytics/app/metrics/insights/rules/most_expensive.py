from app.metrics.insights.engine import Insight, InsightMetrics, insight_rule
from app.metrics.insights.phrases import STAGE_PHRASES, sentence, spent_time
from app.metrics.most_expensive import MostExpensiveStage


@insight_rule
def most_expensive_stage(metrics: InsightMetrics) -> Insight | None:
    stage = metrics.most_expensive
    if not isinstance(stage, MostExpensiveStage):
        return None
    spent = spent_time(stage.invested_days_median)
    return Insight(
        block="funnel",
        title=f"{sentence(STAGE_PHRASES[stage.stage].name)} — найдорожчий етап",
        body=f"Дійшло {stage.reached}, пройшло {stage.passed}. "
        f"Кожна втрата тут — це {spent} вже витраченого часу.",
        severity="warning",
        evidence={
            "stage": stage.stage,
            "reached": stage.reached,
            "passed": stage.passed,
            "lost": stage.lost,
            "investedDaysMedian": stage.invested_days_median,
        },
    )
