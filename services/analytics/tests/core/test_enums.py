import pytest

from app.core.enums import (
    STAGE_ROLES,
    DomainEnums,
    UnhandledStageError,
    check_stages,
    load_domain_enums,
)


def with_stages(stages: tuple[str, ...]) -> DomainEnums:
    return load_domain_enums().model_copy(update={"stages": stages})


def test_the_committed_enums_json_passes_the_stage_check() -> None:
    check_stages(load_domain_enums())


def test_stage_roles_cover_exactly_the_stages_of_enums_json() -> None:
    assert sorted(STAGE_ROLES) == sorted(load_domain_enums().stages)


def test_reads_the_reason_taxonomy_with_its_camel_case_keys() -> None:
    first = load_domain_enums().rejection_reasons[0]

    assert (first.code, first.side, first.label_en, first.sort_order) == (
        "skills_gap",
        "company",
        "Skills gap",
        1,
    )


def test_refuses_a_stage_in_enums_json_that_has_no_role() -> None:
    stages = (*load_domain_enums().stages, "on_hold")

    with pytest.raises(UnhandledStageError, match="on_hold"):
        check_stages(with_stages(stages))


def test_refuses_a_role_for_a_stage_missing_from_enums_json() -> None:
    stages = tuple(s for s in load_domain_enums().stages if s != "offer")

    with pytest.raises(UnhandledStageError, match="offer"):
        check_stages(with_stages(stages))
