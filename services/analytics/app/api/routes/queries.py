import re
from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import Query
from pydantic import AfterValidator, BeforeValidator

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


MONTH_REFUSAL = "must be a calendar month written as YYYY-MM"
MONTH_FORMAT = re.compile(r"([0-9]{4})-([0-9]{2})")


def month_of(raw: str) -> date:
    matched = MONTH_FORMAT.fullmatch(raw)
    if matched is None:
        raise ValueError(MONTH_REFUSAL)
    try:
        return date(int(matched[1]), int(matched[2]), 1)
    except ValueError:
        raise ValueError(MONTH_REFUSAL) from None


MonthQuery = Annotated[Annotated[date, BeforeValidator(month_of)] | None, Query()]
