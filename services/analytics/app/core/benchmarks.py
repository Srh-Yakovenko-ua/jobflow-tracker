from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class MarketBenchmark:
    low: float
    high: float
    source: str
    url: str


MARKET_GHOST_RATE: Final = MarketBenchmark(
    low=0.18,
    high=0.22,
    source=(
        "Greenhouse platform data, 2024: 18 to 22% of jobs posted on Greenhouse"
        " in a quarter are ghost jobs"
    ),
    url="https://www.entrepreneur.com/business-news/ghost-job-listings-on-the-rise-how-to-spot-avoid-experts/485494",
)
