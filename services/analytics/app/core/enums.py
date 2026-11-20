from collections.abc import Mapping
from functools import cache
from pathlib import Path
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ENUMS_FILE = Path(__file__).with_name("enums.json")

type StageRole = Literal["progress", "outcome"]

GHOSTED_STAGE: Final = "ghosted"
REJECTED_STAGE: Final = "rejected"
OFFER_STAGE: Final = "offer"
UNSPECIFIED_REASON: Final = "unspecified"
CANDIDATE_SIDE: Final = "candidate"
LINKEDIN_SOURCE: Final = "linkedin"
ACTIVE_SEARCH: Final = "active"
FOLLOWUP_SENT: Final = "followup_sent"
GROSS_SALARY: Final = "gross"


class EnumsModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, frozen=True, extra="ignore"
    )


class RejectionReason(EnumsModel):
    code: str
    side: str
    label_uk: str
    label_en: str
    sort_order: int


class NoteTopic(EnumsModel):
    code: str
    label_uk: str
    reason_code: str


class Thresholds(EnumsModel):
    min_n_percent: int = Field(alias="MIN_N_PERCENT")
    min_n_insight: int = Field(alias="MIN_N_INSIGHT")
    min_n_forecast: int = Field(alias="MIN_N_FORECAST")
    what_if_conversion: float = Field(alias="WHAT_IF_CONVERSION")
    min_n_note_topic: int = Field(alias="MIN_N_NOTE_TOPIC")
    min_share_note_topic: float = Field(alias="MIN_SHARE_NOTE_TOPIC")


class SalaryRules(EnumsModel):
    per_usd: Mapping[str, float]
    net_share_of_gross: float
    reason_codes: tuple[str, ...]


class AnalyticsCache(EnumsModel):
    version_key: str
    entry_key: str
    ttl_seconds: int


class DomainEnums(EnumsModel):
    stages: tuple[str, ...]
    terminal_stages: tuple[str, ...]
    active_stages: tuple[str, ...]
    outcome_stages: tuple[str, ...]
    interview_stages: tuple[str, ...]
    response_stages: tuple[str, ...]
    reply_stages: tuple[str, ...]
    allowed_transitions: Mapping[str, tuple[str, ...]]
    sources: tuple[str, ...]
    work_modes: tuple[str, ...]
    rejection_sides: tuple[str, ...]
    rejection_reasons: tuple[RejectionReason, ...]
    note_topics: tuple[NoteTopic, ...]
    thresholds: Thresholds
    salary: SalaryRules
    seniorities: tuple[str, ...]
    token_scopes: tuple[str, ...]
    analytics_cache: AnalyticsCache


@cache
def load_domain_enums() -> DomainEnums:
    return DomainEnums.model_validate_json(ENUMS_FILE.read_bytes())


def stages_with_role(role: StageRole) -> tuple[str, ...]:
    enums = load_domain_enums()
    outcome = role == "outcome"
    return tuple(
        stage for stage in enums.stages if (stage in enums.outcome_stages) == outcome
    )


def progress_stages() -> tuple[str, ...]:
    return stages_with_role("progress")


def rejectable_stages() -> tuple[str, ...]:
    enums = load_domain_enums()
    return tuple(
        stage
        for stage in enums.stages
        if REJECTED_STAGE in enums.allowed_transitions[stage]
    )


def reason_codes() -> tuple[str, ...]:
    reasons = load_domain_enums().rejection_reasons
    return tuple(
        reason.code for reason in sorted(reasons, key=lambda reason: reason.sort_order)
    )
