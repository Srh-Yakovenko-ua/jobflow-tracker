from typing import Annotated, Final, Literal

import numpy as np
import pandas as pd
from pydantic import Field

from app.core.enums import load_domain_enums, progress_stages
from app.metrics.data_rules import clean_events
from app.metrics.journeys import journeys
from app.metrics.rate import (
    Insufficient,
    MetricModel,
    Rate,
    RateResult,
    insufficient,
    rate,
)
from app.metrics.score_statistics import (
    VALIDATION_RULES,
    Correlation,
    ScoreRegression,
    logistic_slope,
    point_biserial,
)

type BucketName = Literal["below_50", "from_50_to_74", "from_75"]

BUCKETS: Final[tuple[BucketName, ...]] = ("below_50", "from_50_to_74", "from_75")
SCREENING_INDEX: Final = 1


class ScoreBucket(MetricModel):
    bucket: BucketName
    applications: int
    screening: RateResult
    interview: RateResult


class ScoreStatistics(MetricModel):
    status: Literal["ok"] = "ok"
    applications: int
    correlation: float
    p_value: float
    regression: ScoreRegression | None
    significant: bool
    message: str


type StatisticsResult = Annotated[
    ScoreStatistics | Insufficient, Field(discriminator="status")
]


class MatchValidation(MetricModel):
    scored: int
    unscored: int
    buckets: list[ScoreBucket]
    statistics: StatisticsResult


def decimal_uk(value: float, *, digits: int) -> str:
    return f"{value:.{digits}f}".replace(".", ",")


def interview_index() -> int:
    return progress_stages().index(load_domain_enums().interview_stages[0])


def outcome_rows(events: pd.DataFrame, *, scores: pd.DataFrame) -> pd.DataFrame:
    match_scores = scores.set_index("application_id")["match_score"].astype(float)
    rows = journeys(clean_events(events)).join(match_scores, how="inner")
    return rows.assign(
        reached_screening=rows["deepest"] >= SCREENING_INDEX,
        reached_interview=rows["deepest"] >= interview_index(),
    )


def score_bucket(rows: pd.DataFrame, *, bucket: BucketName) -> ScoreBucket:
    trials = len(rows)
    return ScoreBucket(
        bucket=bucket,
        applications=trials,
        screening=rate(int(rows["reached_screening"].sum()), trials),
        interview=rate(int(rows["reached_interview"].sum()), trials),
    )


def score_buckets(scored: pd.DataFrame) -> list[ScoreBucket]:
    edges = [-np.inf, VALIDATION_RULES.low_edge, VALIDATION_RULES.high_edge, np.inf]
    labels = pd.cut(scored["match_score"], bins=edges, right=False, labels=BUCKETS)
    return [score_bucket(scored[labels == name], bucket=name) for name in BUCKETS]


def ratio_message(buckets: list[ScoreBucket]) -> str | None:
    low, high = buckets[0].interview, buckets[-1].interview
    if not (isinstance(low, Rate) and isinstance(high, Rate)):
        return None
    if not high.value > low.value > 0:
        return None
    ratio = decimal_uk(high.value / low.value, digits=1)
    return (
        f"Вакансії зі збігом {VALIDATION_RULES.high_edge}+ доходять до інтерв'ю "
        f"у {ratio} раза частіше, ніж до {VALIDATION_RULES.low_edge}"
    )


def conclusion(correlation: Correlation, *, buckets: list[ScoreBucket]) -> str:
    if correlation.p_value >= VALIDATION_RULES.alpha:
        return "Match Score поки не передбачає, чи дійде заявка до інтерв'ю"
    if correlation.r < 0:
        return "Заявки з вищим Match Score доходять до інтерв'ю рідше"
    return ratio_message(buckets) or (
        "Що вищий Match Score, то частіше заявка доходить до інтерв'ю"
    )


def class_shortfall(outcomes: pd.Series) -> Insufficient | None:
    threshold = load_domain_enums().thresholds.min_n_percent
    reached = int(outcomes.sum())
    short = insufficient(min(reached, len(outcomes) - reached), threshold=threshold)
    if short is None:
        return None
    message = (
        f"Для висновку потрібно щонайменше {threshold} заявок, "
        f"що дійшли до інтерв'ю, і {threshold}, що не дійшли"
    )
    return short.model_copy(update={"message": message})


def score_statistics(
    scored: pd.DataFrame, *, buckets: list[ScoreBucket]
) -> ScoreStatistics | Insufficient:
    short = class_shortfall(scored["reached_interview"])
    if short is not None:
        return short
    scores = scored["match_score"].to_numpy(dtype=np.float64)
    outcomes = scored["reached_interview"].to_numpy(dtype=np.float64)
    correlation = point_biserial(scores, outcomes)
    return ScoreStatistics(
        applications=len(scored),
        correlation=correlation.r,
        p_value=correlation.p_value,
        regression=logistic_slope(scores, outcomes),
        significant=correlation.p_value < VALIDATION_RULES.alpha,
        message=conclusion(correlation, buckets=buckets),
    )


def match_validation(events: pd.DataFrame, *, scores: pd.DataFrame) -> MatchValidation:
    rows = outcome_rows(events, scores=scores)
    has_score = rows["match_score"].notna()
    scored = rows[has_score]
    buckets = score_buckets(scored)
    return MatchValidation(
        scored=len(scored),
        unscored=int((~has_score).sum()),
        buckets=buckets,
        statistics=score_statistics(scored, buckets=buckets),
    )
