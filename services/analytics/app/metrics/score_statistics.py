from dataclasses import dataclass
from math import atanh, isfinite, sqrt
from statistics import NormalDist
from typing import Final, NamedTuple

import numpy as np
import numpy.typing as npt

from app.metrics.rate import MetricModel, Z

type Values = npt.NDArray[np.float64]


@dataclass(frozen=True)
class ValidationRules:
    alpha: float
    score_step: int
    low_edge: int
    high_edge: int
    max_iterations: int
    tolerance: float


VALIDATION_RULES: Final = ValidationRules(
    alpha=0.05,
    score_step=10,
    low_edge=50,
    high_edge=75,
    max_iterations=25,
    tolerance=1e-8,
)


class Correlation(NamedTuple):
    r: float
    p_value: float


class ScoreRegression(MetricModel):
    slope: float
    low: float
    high: float


class Information(NamedTuple):
    gradient: Values
    hessian: Values


def point_biserial(scores: Values, outcomes: Values) -> Correlation:
    if np.ptp(scores) == 0 or np.ptp(outcomes) == 0:
        return Correlation(0.0, 1.0)
    r = float(np.corrcoef(scores, outcomes)[0, 1])
    if abs(r) >= 1:
        return Correlation(r, 0.0)
    z = atanh(r) * sqrt(len(scores) - 3)
    return Correlation(r, 2 * NormalDist().cdf(-abs(z)))


def information(design: Values, outcomes: Values, *, weights: Values) -> Information:
    chances = (1 + np.tanh(design @ weights / 2)) / 2
    spread = chances * (1 - chances)
    return Information(
        gradient=design.T @ (outcomes - chances),
        hessian=design.T @ (design * spread[:, np.newaxis]),
    )


def fitted_weights(design: Values, outcomes: Values) -> Values | None:
    weights = np.zeros(design.shape[1])
    for _ in range(VALIDATION_RULES.max_iterations):
        gradient, hessian = information(design, outcomes, weights=weights)
        step = np.linalg.solve(hessian, gradient)
        weights = weights + step
        if np.max(np.abs(step)) < VALIDATION_RULES.tolerance:
            return weights
    return None


def logistic_slope(scores: Values, outcomes: Values) -> ScoreRegression | None:
    steps = scores / VALIDATION_RULES.score_step
    design = np.column_stack([np.ones(len(steps)), steps])
    try:
        weights = fitted_weights(design, outcomes)
        if weights is None:
            return None
        hessian = information(design, outcomes, weights=weights).hessian
        variance = float(np.linalg.inv(hessian)[1, 1])
    except np.linalg.LinAlgError:
        return None
    if not (isfinite(variance) and variance >= 0):
        return None
    error = sqrt(variance)
    slope = float(weights[1])
    return ScoreRegression(slope=slope, low=slope - Z * error, high=slope + Z * error)
