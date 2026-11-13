from typing import NamedTuple

from app.metrics.insights.engine import (
    Insight,
    InsightAction,
    InsightMetrics,
    action_rule,
    insight_rule,
)
from app.metrics.insights.phrases import (
    LEAN_ON_SOURCE_TITLES,
    SOURCE_PHRASES,
    sentence,
)
from app.metrics.plurals import (
    APPLICATION_FORMS,
    GAVE_FORMS,
    SCREENING_FORMS,
    counted_uk,
    plural_uk,
)
from app.metrics.rate import Rate
from app.metrics.source_ranking import SMALL_BUT_CLEAR
from app.metrics.sources import SourcePerformance


class SourceGap(NamedTuple):
    weak: SourcePerformance
    strong: SourcePerformance
    comparison: SourcePerformance


def point_share(source: SourcePerformance) -> float:
    if isinstance(source.conversion, Rate):
        return source.conversion.value
    return source.screenings / source.conversion.have


def source_gap(listed: list[SourcePerformance]) -> SourceGap | None:
    rated = [
        (source, source.conversion)
        for source in listed
        if isinstance(source.conversion, Rate)
    ]
    if not rated:
        return None
    weak, weak_conversion = rated[-1]
    others = [source for source, _ in rated if source.source != weak.source]
    clear = [
        source
        for source in listed
        if isinstance(source.conversion, Rate) or source.note == SMALL_BUT_CLEAR
    ]
    strong = max(clear, key=point_share)
    if not others or strong.source == weak.source:
        return None
    if point_share(strong) <= weak_conversion.high:
        return None
    return SourceGap(weak=weak, strong=strong, comparison=others[0])


def gap_evidence(gap: SourceGap) -> dict[str, str | int | float]:
    evidence: dict[str, str | int | float] = {}
    for role, source in gap._asdict().items():
        evidence[role] = source.source
        evidence[f"{role}Applications"] = source.applications
        evidence[f"{role}Screenings"] = source.screenings
    return evidence


@insight_rule
def weak_and_strong_source(metrics: InsightMetrics) -> Insight | None:
    gap = source_gap(metrics.sources.sources)
    if gap is None:
        return None
    weak, strong, comparison = gap
    weak_phrase = SOURCE_PHRASES[weak.source]
    weak_sent = counted_uk(weak.applications, APPLICATION_FORMS)
    gave = plural_uk(weak.applications, GAVE_FORMS)
    return Insight(
        block="sources",
        title=f"{sentence(weak_phrase.name)} {weak_phrase.eats} час, "
        f"{SOURCE_PHRASES[strong.source].name} — ні",
        body=f"{weak_sent} через {weak_phrase.name} {gave} "
        f"{counted_uk(weak.screenings, SCREENING_FORMS)}. "
        f"{sentence(SOURCE_PHRASES[comparison.source].name)} "
        f"при {comparison.applications} — {comparison.screenings}.",
        severity="warning",
        evidence=gap_evidence(gap),
    )


@action_rule
def cut_weak_source(metrics: InsightMetrics) -> InsightAction | None:
    gap = source_gap(metrics.sources.sources)
    if gap is None:
        return None
    weak, _, comparison = gap
    expected = round(
        weak.applications * comparison.screenings / comparison.applications
    )
    if expected <= weak.screenings:
        return None
    weak_sent = counted_uk(weak.applications, APPLICATION_FORMS)
    return InsightAction(
        block="sources",
        title=f"Прибрати {SOURCE_PHRASES[weak.source].name} з рутини",
        expected_effect=f"Ті самі {weak_sent} через "
        f"{SOURCE_PHRASES[comparison.source].name} дали б "
        f"{counted_uk(expected, SCREENING_FORMS)} замість {weak.screenings}.",
    )


@action_rule
def lean_on_strong_source(metrics: InsightMetrics) -> InsightAction | None:
    gap = source_gap(metrics.sources.sources)
    if gap is None:
        return None
    strong = gap.strong
    name = SOURCE_PHRASES[strong.source].name
    small = f" {sentence(SMALL_BUT_CLEAR)}." if strong.note == SMALL_BUT_CLEAR else ""
    return InsightAction(
        block="sources",
        title=LEAN_ON_SOURCE_TITLES.get(strong.source, f"Більше відгуків через {name}"),
        expected_effect=f"{counted_uk(strong.screenings, SCREENING_FORMS)} на "
        f"{counted_uk(strong.applications, APPLICATION_FORMS)} через {name}.{small}",
    )
