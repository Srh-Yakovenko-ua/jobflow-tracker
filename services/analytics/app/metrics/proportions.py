from dataclasses import dataclass
from math import comb, sqrt
from statistics import NormalDist
from typing import Final, Literal, NamedTuple

import numpy as np

type ProportionTestName = Literal["z_test", "fisher_exact"]


@dataclass(frozen=True)
class AbRules:
    seed: int
    draws: int
    clear: float
    likely: float
    min_expected: int
    tie_tolerance: float


AB_RULES: Final = AbRules(
    seed=2026,
    draws=100_000,
    clear=0.95,
    likely=0.80,
    min_expected=5,
    tie_tolerance=1e-7,
)


class Counts(NamedTuple):
    successes: int
    trials: int


class ProportionTest(NamedTuple):
    name: ProportionTestName
    p_value: float


def share(counts: Counts) -> float:
    return counts.successes / counts.trials if counts.trials else 0.0


def pooled(challenger: Counts, baseline: Counts) -> float:
    return share(
        Counts(
            challenger.successes + baseline.successes,
            challenger.trials + baseline.trials,
        )
    )


def z_test(challenger: Counts, baseline: Counts) -> float:
    common = pooled(challenger, baseline)
    spread = 1 / challenger.trials + 1 / baseline.trials
    error = sqrt(common * (1 - common) * spread)
    z = (share(challenger) - share(baseline)) / error
    return 2 * NormalDist().cdf(-abs(z))


def fisher_exact(challenger: Counts, baseline: Counts) -> float:
    successes = challenger.successes + baseline.successes
    tables = comb(challenger.trials + baseline.trials, successes)
    lowest = max(0, successes - baseline.trials)
    highest = min(successes, challenger.trials)
    chances = [
        comb(challenger.trials, cell) * comb(baseline.trials, successes - cell) / tables
        for cell in range(lowest, highest + 1)
    ]
    observed = chances[challenger.successes - lowest]
    limit = observed * (1 + AB_RULES.tie_tolerance)
    return min(1.0, sum(chance for chance in chances if chance <= limit))


def proportion_test(challenger: Counts, baseline: Counts) -> ProportionTest:
    common = pooled(challenger, baseline)
    expected = [
        counts.trials * part
        for counts in (challenger, baseline)
        for part in (common, 1 - common)
    ]
    if min(expected) < AB_RULES.min_expected:
        return ProportionTest("fisher_exact", fisher_exact(challenger, baseline))
    return ProportionTest("z_test", z_test(challenger, baseline))


def probability_better(challenger: Counts, baseline: Counts) -> float:
    rng = np.random.default_rng(AB_RULES.seed)
    ahead, behind = (
        rng.beta(
            1 + counts.successes, 1 + counts.trials - counts.successes, AB_RULES.draws
        )
        for counts in (challenger, baseline)
    )
    return float(np.mean(ahead > behind))
