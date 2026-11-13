from app.core.enums import load_domain_enums
from app.metrics.insights.engine import Insight, InsightMetrics, insight_rule
from app.metrics.insights.phrases import REASON_TITLES, STAGE_PHRASES, sentence
from app.metrics.plurals import OF_REJECTIONS_FORMS, plural_uk
from app.metrics.reasons_trend import TopReason


@insight_rule
def dominant_reason(metrics: InsightMetrics) -> Insight | None:
    top = metrics.reasons.headline
    if not isinstance(top, TopReason):
        return None
    reason = next(
        reason
        for reason in load_domain_enums().rejection_reasons
        if reason.code == top.code
    )
    title = REASON_TITLES[reason.side].format(
        at=STAGE_PHRASES[top.stage].at, label=reason.label_uk
    )
    rejections = plural_uk(top.of, OF_REJECTIONS_FORMS)
    return Insight(
        block="reasons",
        title=sentence(title),
        body=f"{top.count} із {top.of} {rejections} на цьому етапі "
        f"— «{reason.label_uk}».",
        severity="warning",
        evidence={
            "stage": top.stage,
            "code": top.code,
            "count": top.count,
            "of": top.of,
        },
    )
