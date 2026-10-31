import pytest

from app.factory import create_app
from app.prompts import (
    PROMPTS,
    PromptVersionMismatchError,
    load_prompt_versions,
    vacancy_parse,
)
from tests.factories import settings_for


def test_reads_the_prompt_versions_exported_from_the_shared_package() -> None:
    assert load_prompt_versions() == {"vacancy_parse": "v1"}


def test_refuses_to_boot_when_a_prompt_version_differs_from_ai_prompt_versions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(vacancy_parse, "PROMPT_VERSION", "v0")

    with pytest.raises(
        PromptVersionMismatchError,
        match="vacancy_parse: AI_PROMPT_VERSIONS v1, prompt module v0",
    ):
        create_app(settings_for())


def test_refuses_to_boot_when_a_kind_has_no_prompt_module(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delitem(PROMPTS, "vacancy_parse")

    with pytest.raises(
        PromptVersionMismatchError,
        match="vacancy_parse: AI_PROMPT_VERSIONS v1, prompt module none",
    ):
        create_app(settings_for())


def test_refuses_to_boot_when_a_prompt_module_has_no_shared_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(PROMPTS, "horoscope", vacancy_parse)

    with pytest.raises(
        PromptVersionMismatchError,
        match="horoscope: AI_PROMPT_VERSIONS none, prompt module v1",
    ):
        create_app(settings_for())
