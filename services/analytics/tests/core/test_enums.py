import pytest

from app.core.auth import READ_SCOPE
from app.core.enums import (
    CANDIDATE_SIDE,
    GHOSTED_STAGE,
    LINKEDIN_SOURCE,
    OFFER_STAGE,
    STAGE_ROLES,
    DomainEnums,
    UnhandledStageError,
    check_stages,
    load_domain_enums,
    progress_stages,
    rejectable_stages,
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


def test_reads_the_note_topics_with_their_ukrainian_labels_in_order() -> None:
    topics = load_domain_enums().note_topics

    assert [(topic.code, topic.label_uk) for topic in topics] == [
        ("algorithms", "Алгоритми"),
        ("dp", "Динамічне програмування"),
        ("system_design", "System design"),
        ("english", "Англійська"),
        ("take_home", "Тестове завдання"),
        ("react_internals", "React internals"),
        ("sql", "SQL"),
        ("behavioural", "Поведінкові питання"),
    ]


def test_reads_the_data_rule_thresholds_from_their_upper_case_keys() -> None:
    thresholds = load_domain_enums().thresholds

    assert (
        thresholds.min_n_percent,
        thresholds.min_n_insight,
        thresholds.min_n_forecast,
        thresholds.what_if_conversion,
        thresholds.min_n_note_topic,
    ) == (5, 10, 15, 0.6, 3)


def test_reads_the_analytics_cache_key_templates_shared_with_the_worker() -> None:
    cache = load_domain_enums().analytics_cache

    assert (cache.version_key, cache.entry_key, cache.ttl_seconds) == (
        "analytics:{userId}:version",
        "analytics:{userId}:v{version}:{metric}:{paramsHash}",
        3600,
    )


def test_reads_the_salary_rates_and_seniorities_shared_with_the_web() -> None:
    enums = load_domain_enums()

    assert (
        dict(enums.salary.per_usd),
        enums.salary.net_share_of_gross,
        enums.salary.reason_codes,
        enums.seniorities,
    ) == (
        {"USD": 1, "EUR": 0.86, "UAH": 41.5},
        0.77,
        ("salary_expectations", "low_salary"),
        ("intern", "junior", "middle", "senior", "lead"),
    )


def test_the_funnel_stages_are_the_progress_stages_in_enums_json_order() -> None:
    assert progress_stages() == (
        "applied",
        "screening",
        "tech_interview",
        "final",
        "offer",
    )


def test_rejections_leave_only_the_stages_whose_transitions_allow_them() -> None:
    assert rejectable_stages() == ("applied", "screening", "tech_interview", "final")


def test_the_ghosted_and_offer_stages_are_stages_exported_by_the_shared_package() -> (
    None
):
    assert {GHOSTED_STAGE, OFFER_STAGE} <= set(load_domain_enums().stages)


def test_a_reply_is_a_move_to_screening_tech_interview_or_rejected() -> None:
    assert load_domain_enums().response_stages == (
        "screening",
        "tech_interview",
        "rejected",
    )


def test_the_active_stages_are_the_four_stages_that_carry_a_norm() -> None:
    assert load_domain_enums().active_stages == (
        "applied",
        "screening",
        "tech_interview",
        "final",
    )


def test_a_company_reply_moves_to_a_reply_stage_exported_by_the_shared_package() -> (
    None
):
    assert load_domain_enums().reply_stages == (
        "applied",
        "screening",
        "tech_interview",
        "final",
        "offer",
        "rejected",
    )


def test_the_candidate_side_is_a_rejection_side_exported_by_the_shared_package() -> (
    None
):
    assert CANDIDATE_SIDE in load_domain_enums().rejection_sides


def test_linkedin_is_a_source_exported_by_the_shared_package() -> None:
    assert LINKEDIN_SOURCE in load_domain_enums().sources


def test_the_read_scope_is_a_token_scope_exported_by_the_shared_package() -> None:
    assert READ_SCOPE in load_domain_enums().token_scopes


def test_refuses_a_stage_in_enums_json_that_has_no_role() -> None:
    stages = (*load_domain_enums().stages, "on_hold")

    with pytest.raises(UnhandledStageError, match="on_hold"):
        check_stages(with_stages(stages))


def test_refuses_a_role_for_a_stage_missing_from_enums_json() -> None:
    stages = tuple(s for s in load_domain_enums().stages if s != "offer")

    with pytest.raises(UnhandledStageError, match="offer"):
        check_stages(with_stages(stages))
