from app.metrics.forecast import Forecast
from app.metrics.insights.engine import (
    WHAT_IF_CONVERSION,
    Insight,
    InsightAction,
    InsightMetrics,
    action_rule,
    insight_rule,
)
from app.metrics.insights.phrases import (
    STAGE_PHRASES,
    percent,
    sentence,
    spent_time,
    whole_weeks,
)
from app.metrics.most_expensive import MostExpensiveStage
from app.metrics.plurals import (
    PASSED_FORMS,
    REACHED_FORMS,
    UP_TO_WEEK_FORMS,
    plural_uk,
)


@insight_rule
def most_expensive_stage(metrics: InsightMetrics) -> Insight | None:
    stage = metrics.most_expensive
    if not isinstance(stage, MostExpensiveStage):
        return None
    spent = spent_time(stage.invested_days_median)
    return Insight(
        block="funnel",
        title=f"{sentence(STAGE_PHRASES[stage.stage].name)} — найдорожчий етап",
        body=f"{sentence(plural_uk(stage.reached, REACHED_FORMS))} {stage.reached}, "
        f"{plural_uk(stage.passed, PASSED_FORMS)} {stage.passed}. "
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


def narrowed_weeks(low: int, high: int) -> str:
    unit = plural_uk(high, UP_TO_WEEK_FORMS)
    if low == high:
        return f"до {high} {unit}"
    return f"до діапазону від {low} до {high} {unit}"


@action_rule
def practice_costly_stage(metrics: InsightMetrics) -> InsightAction | None:
    stage, what_if = metrics.most_expensive, metrics.stage_what_if
    if not isinstance(stage, MostExpensiveStage) or not isinstance(what_if, Forecast):
        return None
    low, high = what_if.likely.low, what_if.likely.high
    if low is None or high is None:
        return None
    weeks = narrowed_weeks(whole_weeks(low), whole_weeks(high))
    return InsightAction(
        block="funnel",
        title=f"Підготуватися до {STAGE_PHRASES[stage.stage].next}",
        expected_effect=f"Прогноз офера звузиться {weeks}, "
        f"якщо конверсія дійде до {percent(WHAT_IF_CONVERSION)}%.",
    )
