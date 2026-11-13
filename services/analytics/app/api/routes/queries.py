from typing import Annotated
from uuid import UUID

from fastapi import Query
from pydantic import AfterValidator

from app.core.enums import load_domain_enums
from app.metrics.offer_simulation import Improvement

SearchIdQuery = Annotated[UUID | None, Query(alias="searchId")]
ApplicationsPerWeekQuery = Annotated[
    float | None, Query(alias="applicationsPerWeek", ge=0, allow_inf_nan=False)
]


IMPROVE_REFUSAL = "must be an active stage and a conversion in (0, 1]"


def improvement_of(raw: str) -> Improvement:
    stage, _, value = raw.partition(":")
    try:
        conversion = float(value)
    except ValueError:
        raise ValueError(IMPROVE_REFUSAL) from None
    if stage not in load_domain_enums().active_stages or not 0 < conversion <= 1:
        raise ValueError(IMPROVE_REFUSAL)
    return Improvement(stage, conversion)


def parse_improvement(raw: str) -> str:
    improvement_of(raw)
    return raw


ImproveQuery = Annotated[
    Annotated[str, AfterValidator(parse_improvement)] | None, Query()
]
