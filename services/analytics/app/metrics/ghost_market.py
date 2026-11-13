from typing import Literal

import pandas as pd

from app.core.benchmarks import MARKET_GHOST_RATE, MarketBenchmark
from app.metrics.data_rules import ghost_rate
from app.metrics.rate import MetricModel, Rate, RateResult

type GapPosition = Literal["below", "within", "above"]


class GhostGap(MetricModel):
    position: GapPosition
    points: int


class GhostRateVsMarket(MetricModel):
    rate: RateResult
    market: MarketBenchmark
    gap: GhostGap | None


def gap_to(market: MarketBenchmark, *, share: float) -> GhostGap:
    if share < market.low:
        return GhostGap(position="below", points=round((market.low - share) * 100))
    if share > market.high:
        return GhostGap(position="above", points=round((share - market.high) * 100))
    return GhostGap(position="within", points=0)


def ghost_rate_vs_market(events: pd.DataFrame) -> GhostRateVsMarket:
    rate = ghost_rate(events)
    gap = (
        gap_to(MARKET_GHOST_RATE, share=rate.value) if isinstance(rate, Rate) else None
    )
    return GhostRateVsMarket(rate=rate, market=MARKET_GHOST_RATE, gap=gap)
