from dataclasses import dataclass
from typing import Final, NamedTuple

import numpy as np
import numpy.typing as npt

from app.core.enums import load_domain_enums
from app.metrics.forecast_inputs import Days, InFlight, PassCounts

SIMULATIONS: Final = 10_000
HORIZON_WEEKS: Final = 52
OFFERED_CANDIDATES: Final = 64
DAYS_PER_WEEK: Final = 7.0

type Weeks = npt.NDArray[np.float64]
type Chances = npt.NDArray[np.float64]


class Improvement(NamedTuple):
    stage: str
    conversion: float


@dataclass(frozen=True)
class Pipeline:
    passes: PassCounts
    stays: tuple[Days, ...]
    in_flight: InFlight
    rate: float
    improve: Improvement | None


def pass_chances(rng: np.random.Generator, pipeline: Pipeline) -> Chances:
    successes = np.asarray(pipeline.passes.successes)
    failures = np.asarray(pipeline.passes.failures)
    chances = rng.beta(1 + successes, 1 + failures, (SIMULATIONS, successes.size))
    if pipeline.improve is not None:
        stage = load_domain_enums().active_stages.index(pipeline.improve.stage)
        chances[:, stage] = pipeline.improve.conversion
    return chances


def in_flight_weeks(
    rng: np.random.Generator, pipeline: Pipeline, *, chances: Chances
) -> Weeks:
    stages, elapsed = pipeline.in_flight
    shape = (SIMULATIONS, stages.size)
    passing = np.ones(shape, dtype=bool)
    days = np.zeros(shape)
    for index, pool in enumerate(pipeline.stays):
        passed = rng.random(shape) < chances[:, [index]]
        stay = rng.choice(pool, size=shape)
        passing &= passed | (index < stages)
        residual = np.where(index == stages, np.clip(stay - elapsed, 0, None), stay)
        days += np.where(index >= stages, residual, 0.0)
    weeks = np.where(passing, days / DAYS_PER_WEEK, np.inf)
    return weeks.min(axis=1, initial=np.inf)


def new_offer_weeks(
    rng: np.random.Generator, pipeline: Pipeline, *, chances: Chances
) -> Weeks:
    shape = (SIMULATIONS, OFFERED_CANDIDATES)
    gaps = rng.standard_exponential(shape)
    days = sum(
        (rng.choice(pool, size=shape) for pool in pipeline.stays), np.zeros(shape)
    )
    offered_rate = pipeline.rate * chances.prod(axis=1, keepdims=True)
    with np.errstate(divide="ignore", over="ignore", invalid="ignore"):
        arrivals = np.cumsum(gaps, axis=1) / offered_rate
    weeks = np.where(arrivals < HORIZON_WEEKS, arrivals + days / DAYS_PER_WEEK, np.inf)
    return weeks.min(axis=1)


def first_offer_weeks(pipeline: Pipeline, *, seed: int) -> Weeks:
    rng = np.random.default_rng(seed)
    chances = pass_chances(rng, pipeline)
    current = in_flight_weeks(rng, pipeline, chances=chances)
    upcoming = new_offer_weeks(rng, pipeline, chances=chances)
    first = np.minimum(current, upcoming)
    return np.where(first <= HORIZON_WEEKS, first, np.inf)
