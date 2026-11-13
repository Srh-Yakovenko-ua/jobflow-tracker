from app.core.enums import GHOSTED_STAGE, REJECTED_STAGE
from app.metrics.funnel import FunnelStage
from app.metrics.insights.engine import Insight, InsightMetrics, insight_rule
from app.metrics.insights.phrases import STAGE_PHRASES
from app.metrics.plurals import REJECTION_FORMS, SILENCE_FORMS, counted_uk
from app.metrics.rate import Rate


def entry_leak(stage: FunnelStage) -> Insight:
    rejected = stage.drop_off[REJECTED_STAGE]
    ghosted = stage.drop_off[GHOSTED_STAGE]
    losses = f"{counted_uk(rejected, REJECTION_FORMS)} і {counted_uk(ghosted, SILENCE_FORMS)}"
    return Insight(
        block="funnel",
        title="Найширша втеча — на першому кроці",
        body=f"{losses} із {stage.reached} — воронка закінчується там, "
        "де ти ще ні з ким не говорив.",
        severity="neutral",
        evidence={
            "stage": stage.stage,
            "reached": stage.reached,
            "rejected": rejected,
            "ghosted": ghosted,
        },
    )


def later_narrowing(stage: str, *, conversion: Rate) -> Insight:
    passed = f"пройшло {conversion.successes} із {conversion.trials}"
    return Insight(
        block="funnel",
        title="Далі об'єм відгуків уже не допоможе",
        body=f"Воронка звужується не на вході, а {STAGE_PHRASES[stage].at}: {passed}.",
        severity="warning",
        evidence={
            "stage": stage,
            "passed": conversion.successes,
            "trials": conversion.trials,
        },
    )


@insight_rule
def narrowest_step(metrics: InsightMetrics) -> Insight | None:
    rated = [
        (index, stage.conversion)
        for index, stage in enumerate(metrics.stages)
        if isinstance(stage.conversion, Rate)
    ]
    if not rated:
        return None
    index, conversion = min(rated, key=lambda step: (step[1].value, step[0]))
    if index == 0:
        return entry_leak(metrics.stages[0])
    return later_narrowing(metrics.stages[index].stage, conversion=conversion)
