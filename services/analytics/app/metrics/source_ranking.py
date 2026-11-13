from collections.abc import Iterable, Mapping
from typing import Final

from app.core.enums import GHOSTED_STAGE, load_domain_enums
from app.metrics.funnel import FunnelStage
from app.metrics.rate import Rate, wilson_interval

SMALL_BUT_CLEAR: Final = "вибірка мала, але напрям однозначний"
RATED_TIER, SMALL_SAMPLE_TIER, WITHOUT_TRIALS_TIER = range(3)

type RankKey = tuple[int, float, int, int]


def conversion_counts(stage: FunnelStage) -> tuple[int, int]:
    return stage.passed or 0, stage.reached - stage.drop_off[GHOSTED_STAGE]


def pooled_share(stages: Iterable[FunnelStage]) -> float:
    counts = [conversion_counts(stage) for stage in stages]
    trials = sum(trials for _, trials in counts)
    return sum(successes for successes, _ in counts) / trials if trials else 0.0


def note(stage: FunnelStage, *, pooled: float) -> str | None:
    successes, trials = conversion_counts(stage)
    if isinstance(stage.conversion, Rate) or trials == 0:
        return None
    low, high = wilson_interval(successes, trials)
    return SMALL_BUT_CLEAR if pooled < low or pooled > high else None


def rank_key(stage: FunnelStage, *, order: int) -> RankKey:
    successes, trials = conversion_counts(stage)
    if trials == 0:
        return (WITHOUT_TRIALS_TIER, 0.0, -stage.reached, order)
    tier = RATED_TIER if isinstance(stage.conversion, Rate) else SMALL_SAMPLE_TIER
    low, _ = wilson_interval(successes, trials)
    return (tier, -low, -stage.reached, order)


def rank(stages: Mapping[str, FunnelStage]) -> list[str]:
    order = load_domain_enums().sources
    return sorted(
        stages,
        key=lambda source: rank_key(stages[source], order=order.index(source)),
    )
