from collections.abc import Callable
from typing import Final, NamedTuple

import numpy as np
import pandas as pd

from tests.factories import MatchScore, application, match_scores_frame
from tests.metrics.sankey_fixtures import (
    APPLIED,
    SCREENING,
    Journey,
    cohort,
    reasoned_frame,
)

REACHED_INTERVIEW: Final = cohort(
    (*SCREENING, "tech_interview"), end=("rejected", "skills_gap"), count=1
)[0]
REACHED_SCREENING: Final = cohort(
    SCREENING, end=("rejected", "no_explanation"), count=1
)[0]
GHOSTED: Final = cohort(APPLIED, end=("ghosted", None), count=1)[0]

SCORED_APPLICATIONS: Final = 150
UNSCORED_APPLICATIONS: Final = 6
LOWEST_SCORE: Final = 20
SCORE_SPAN: Final = 80
AVERAGE_INTERVIEW: Final = 0.35
SCREENING_LIFT: Final = 0.25
DEPENDENT_EFFECT: Final = 0.6
DEPENDENT_SEED: Final = 2026
RANDOM_SEED: Final = 2027

type ScoredJourney = tuple[int | None, Journey]


class Scenario(NamedTuple):
    events: pd.DataFrame
    scores: pd.DataFrame


def scored_applications(rows: list[ScoredJourney]) -> Scenario:
    return Scenario(
        events=reasoned_frame([journey for _, journey in rows]),
        scores=match_scores_frame(
            [
                MatchScore(application(index), score)
                for index, (score, _) in enumerate(rows)
            ]
        ),
    )


def drawn_journey(draw: float, *, interview: float) -> Journey:
    if draw < interview:
        return REACHED_INTERVIEW
    if draw < interview + SCREENING_LIFT:
        return REACHED_SCREENING
    return GHOSTED


def scenario(seed: int, *, effect: float) -> Scenario:
    rng = np.random.default_rng(seed)
    scores = rng.integers(
        LOWEST_SCORE, LOWEST_SCORE + SCORE_SPAN + 1, SCORED_APPLICATIONS
    )
    position = (scores - LOWEST_SCORE) / SCORE_SPAN - 1 / 2
    chances = np.clip(AVERAGE_INTERVIEW + effect * position, 0, 1)
    draws = rng.random(SCORED_APPLICATIONS)
    scored: list[ScoredJourney] = [
        (int(score), drawn_journey(float(draw), interview=float(chance)))
        for score, draw, chance in zip(scores, draws, chances, strict=True)
    ]
    unscored: list[ScoredJourney] = [(None, REACHED_INTERVIEW)] * UNSCORED_APPLICATIONS
    return scored_applications([*unscored, *scored])


def dependent() -> Scenario:
    return scenario(DEPENDENT_SEED, effect=DEPENDENT_EFFECT)


def random_outcomes() -> Scenario:
    return scenario(RANDOM_SEED, effect=0.0)


SCENARIOS: Final[dict[str, Callable[[], Scenario]]] = {
    "Залежить від балу": dependent,
    "Випадковий": random_outcomes,
}


def four_in_the_top_bucket() -> Scenario:
    return scored_applications(
        [
            *[(80, REACHED_INTERVIEW)] * 4,
            *[(60, REACHED_SCREENING)] * 5,
            *[(30, GHOSTED)] * 6,
        ]
    )
