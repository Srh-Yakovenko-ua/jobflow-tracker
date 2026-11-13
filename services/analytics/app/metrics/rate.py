from math import sqrt
from statistics import NormalDist
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.core.enums import load_domain_enums

Z = NormalDist().inv_cdf(0.975)


class MetricModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, frozen=True
    )


class Rate(MetricModel):
    status: Literal["ok"] = "ok"
    value: float
    low: float
    high: float
    successes: int
    trials: int


class Insufficient(MetricModel):
    status: Literal["insufficient_data"] = "insufficient_data"
    have: int
    need: int
    message: str


type RateResult = Annotated[Rate | Insufficient, Field(discriminator="status")]


def wilson_interval(successes: int, trials: int) -> tuple[float, float]:
    share = successes / trials
    spread = Z * Z / trials
    center = share + spread / 2
    margin = Z * sqrt(share * (1 - share) / trials + spread / (4 * trials))
    low = 0.0 if successes == 0 else max(0.0, (center - margin) / (1 + spread))
    high = 1.0 if successes == trials else min(1.0, (center + margin) / (1 + spread))
    return low, high


def _applications_word(count: int) -> str:
    if count % 10 == 1 and count % 100 != 11:
        return "відгук"
    if count % 10 in range(2, 5) and count % 100 not in range(12, 15):
        return "відгуки"
    return "відгуків"


def insufficient(have: int, *, threshold: int) -> Insufficient | None:
    if have >= threshold:
        return None
    need = threshold - have
    message = f"Ще {need} {_applications_word(need)} до першого висновку"
    return Insufficient(have=have, need=need, message=message)


def percent_shortfall(have: int) -> Insufficient | None:
    return insufficient(have, threshold=load_domain_enums().thresholds.min_n_percent)


def rate(successes: int, trials: int) -> Rate | Insufficient:
    short = percent_shortfall(trials)
    if short is not None:
        return short
    low, high = wilson_interval(successes, trials)
    return Rate(
        value=successes / trials,
        low=low,
        high=high,
        successes=successes,
        trials=trials,
    )
