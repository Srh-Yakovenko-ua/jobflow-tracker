from collections.abc import Mapping
from functools import cache
from pathlib import Path
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

ENUMS_FILE = Path(__file__).with_name("enums.json")

type StageRole = Literal["progress", "outcome"]

STAGE_ROLES: Final[Mapping[str, StageRole]] = {
    "applied": "progress",
    "screening": "progress",
    "tech_interview": "progress",
    "final": "progress",
    "offer": "progress",
    "rejected": "outcome",
    "ghosted": "outcome",
    "withdrawn": "outcome",
}


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


class DomainEnums(EnumsModel):
    stages: tuple[str, ...]
    terminal_stages: tuple[str, ...]
    interview_stages: tuple[str, ...]
    sources: tuple[str, ...]
    work_modes: tuple[str, ...]
    rejection_sides: tuple[str, ...]
    rejection_reasons: tuple[RejectionReason, ...]
    token_scopes: tuple[str, ...]


class UnhandledStageError(ValueError):
    pass


@cache
def load_domain_enums() -> DomainEnums:
    return DomainEnums.model_validate_json(ENUMS_FILE.read_bytes())


def check_stages(enums: DomainEnums) -> None:
    declared = set(enums.stages)
    without_role = sorted(declared - STAGE_ROLES.keys())
    without_stage = sorted(STAGE_ROLES.keys() - declared)
    if without_role or without_stage:
        raise UnhandledStageError(
            f"stages in enums.json without a role: {without_role or 'none'}; "
            f"roles for stages missing from enums.json: {without_stage or 'none'}"
        )
