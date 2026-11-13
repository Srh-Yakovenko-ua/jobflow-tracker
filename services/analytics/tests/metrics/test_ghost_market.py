import pytest

from app.core.benchmarks import MarketBenchmark
from app.metrics.ghost_market import GhostGap, ghost_rate_vs_market
from app.metrics.rate import Insufficient
from tests.metrics.sankey_fixtures import APPLIED, cohort, reasoned_frame

GREENHOUSE = MarketBenchmark(
    low=0.18,
    high=0.22,
    source=(
        "Greenhouse platform data, 2024: 18 to 22% of jobs posted on Greenhouse"
        " in a quarter are ghost jobs"
    ),
    url="https://www.entrepreneur.com/business-news/ghost-job-listings-on-the-rise-how-to-spot-avoid-experts/485494",
)

COHORTS = {
    "none of six ghosted": (0, 6, GhostGap(position="below", points=18)),
    "one of five ghosted": (1, 5, GhostGap(position="within", points=0)),
    "five of sixteen ghosted": (5, 16, GhostGap(position="above", points=9)),
}


@pytest.mark.parametrize(
    ("ghosted", "total", "gap"), list(COHORTS.values()), ids=list(COHORTS)
)
def test_places_the_ghost_rate_against_the_greenhouse_range(
    ghosted: int, *, total: int, gap: GhostGap
) -> None:
    events = reasoned_frame(
        [
            *cohort(APPLIED, end=("ghosted", None), count=ghosted),
            *cohort(APPLIED, end=("screening", None), count=total - ghosted),
        ]
    )

    compared = ghost_rate_vs_market(events)

    assert (compared.gap, compared.market) == (gap, GREENHOUSE)


def test_gives_no_gap_while_the_ghost_rate_lacks_data() -> None:
    events = reasoned_frame(cohort(APPLIED, end=("ghosted", None), count=3))

    compared = ghost_rate_vs_market(events)

    assert (compared.rate, compared.gap) == (
        Insufficient(have=3, need=2, message="Ще 2 відгуки до першого висновку"),
        None,
    )
