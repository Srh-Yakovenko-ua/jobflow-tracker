from collections.abc import Mapping
from typing import Final

from app.metrics.ghost_market import GapPosition
from app.metrics.insights.engine import Insight, InsightMetrics, insight_rule
from app.metrics.insights.phrases import percent
from app.metrics.plurals import COMPANY_FORMS, NO_REPLY_FORMS, counted_uk, plural_uk
from app.metrics.rate import Rate

GAP_PHRASES: Final[Mapping[GapPosition, str]] = {
    "above": "на {points} п.п. більше за ринок",
    "below": "на {points} п.п. менше за ринок",
    "within": "у межах ринку",
}


@insight_rule
def ghost_share(metrics: InsightMetrics) -> Insight | None:
    share, gap = metrics.ghosts.rate, metrics.ghosts.gap
    if not isinstance(share, Rate) or gap is None:
        return None
    silent = share.successes
    versus = GAP_PHRASES[gap.position].format(points=gap.points)
    return Insight(
        block="ghosted",
        title=f"{counted_uk(silent, COMPANY_FORMS)} {plural_uk(silent, NO_REPLY_FORMS)}",
        body=f"Це {percent(share.value)}% твоїх відгуків — {versus}.",
        severity="neutral",
        evidence={
            "ghosted": silent,
            "applications": share.trials,
            "sharePercent": percent(share.value),
            "position": gap.position,
            "gapPoints": gap.points,
        },
    )
