from app.metrics.insights.engine import (
    Insight,
    InsightAction,
    InsightMetrics,
    action_rule,
    insight_rule,
)
from app.metrics.insights.phrases import dollars
from app.metrics.plurals import (
    APPLICATION_FORMS,
    REJECTION_FORMS,
    WERE_FORMS,
    counted_uk,
    plural_uk,
)
from app.metrics.salary_floor import SalaryFloor


def raised_floor(metrics: InsightMetrics) -> SalaryFloor | None:
    return None if metrics.salary is None else metrics.salary.floor


def saved_applications(floor: SalaryFloor) -> str:
    low, high = floor.per_month_low, floor.per_month_high
    if low == high:
        return counted_uk(high, APPLICATION_FORMS)
    return f"{low} або {high} {plural_uk(high, APPLICATION_FORMS)}"


@insight_rule
def salary_floor_note(metrics: InsightMetrics) -> Insight | None:
    floor = raised_floor(metrics)
    if floor is None:
        return None
    below = dollars(floor.floor)
    return Insight(
        block="salary",
        title=f"Відмови через зарплату: усі на вилках нижче {below}",
        body=f"{counted_uk(floor.rejections, REJECTION_FORMS)} через зарплатні "
        f"очікування, усі по вакансіях із вилкою нижче {below}. "
        "Нижню межу фільтра варто підняти.",
        severity="warning",
        evidence={
            "floor": floor.floor,
            "rejections": floor.rejections,
            "below": floor.below,
        },
    )


@action_rule
def raise_salary_floor(metrics: InsightMetrics) -> InsightAction | None:
    floor = raised_floor(metrics)
    if floor is None:
        return None
    return InsightAction(
        block="salary",
        title=f"Підняти нижню межу вилки до {dollars(floor.floor)}",
        expected_effect=f"{counted_uk(floor.rejections, REJECTION_FORMS)} вже "
        f"{plural_uk(floor.rejections, WERE_FORMS)} через зарплатні очікування, "
        "фільтр зекономить "
        f"{saved_applications(floor)} на місяць.",
    )
