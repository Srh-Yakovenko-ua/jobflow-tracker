import numpy as np
import pytest

from app.metrics.score_statistics import (
    Correlation,
    logistic_slope,
    point_biserial,
)

SCORES = np.arange(10.0, 101.0, 10.0)
REACHED = np.array([0, 0, 0, 1, 0, 1, 0, 1, 1, 1], dtype=float)
SWEEP_SEEDS = 300
SWEEP_SIZE = 100


def test_correlates_scores_with_reached_interview_by_point_biserial_r() -> None:
    correlation = point_biserial(SCORES, REACHED)

    assert correlation == pytest.approx(Correlation(0.6615, 0.0353), abs=1e-4)


def test_fits_a_rising_log_odds_slope_per_ten_points() -> None:
    regression = logistic_slope(SCORES, REACHED)

    assert regression is not None
    assert regression.low < regression.slope < regression.high
    assert regression.slope > 0


def test_answers_r_0_and_p_1_when_every_score_is_the_same() -> None:
    assert point_biserial(np.full(10, 60.0), REACHED) == Correlation(0.0, 1.0)


def test_gives_no_regression_when_scores_separate_the_outcomes_perfectly() -> None:
    separated = (SCORES > 50).astype(float)

    assert logistic_slope(SCORES, separated) is None
    assert point_biserial(SCORES, separated).p_value < 0.01


def test_flags_about_5_percent_of_random_outcomes_as_significant() -> None:
    p_values = []
    for seed in range(SWEEP_SEEDS):
        rng = np.random.default_rng(seed)
        scores = rng.integers(20, 101, size=SWEEP_SIZE).astype(float)
        outcomes = (rng.random(SWEEP_SIZE) < 0.3).astype(float)
        p_values.append(point_biserial(scores, outcomes).p_value)

    assert 0.02 <= np.mean(np.array(p_values) < 0.05) <= 0.09
