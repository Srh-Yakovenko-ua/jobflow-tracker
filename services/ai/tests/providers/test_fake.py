import json
from dataclasses import replace

import pytest

from app.contracts.vacancy_parse_request import VacancyParseRequest
from app.core.errors import AppError
from app.core.pii import scrub
from app.prompts import vacancy_parse
from app.providers.base import CompletionRequest, Message
from app.providers.fake import FakeAiProvider
from tests.factories import (
    COMPLETION_REQUEST,
    PARSED_VACANCY,
    UNNAMED_VACANCY,
    failing_vacancy,
)

pytestmark = pytest.mark.anyio


def asking(text: str) -> CompletionRequest:
    return replace(COMPLETION_REQUEST, messages=[Message(role="user", content=text)])


@pytest.mark.parametrize(
    ("failure", "status", "detail"),
    [
        ("ai_timeout", 504, "The model did not answer within 30 seconds"),
        ("ai_provider_error", 502, "The AI provider failed"),
    ],
)
async def test_fails_the_way_a_vendor_does_when_the_text_carries_the_marker(
    *, failure: str, status: int, detail: str
) -> None:
    fake = FakeAiProvider(timeout_seconds=30)

    with pytest.raises(AppError) as failed:
        await fake.complete(asking(failing_vacancy(failure)))

    assert (failed.value.status, failed.value.detail) == (status, detail)


async def test_answers_without_company_and_position_for_their_marker() -> None:
    completion = await FakeAiProvider().complete(
        asking(failing_vacancy("no_company_no_position"))
    )

    assert json.loads(completion.text) == UNNAMED_VACANCY


@pytest.mark.parametrize(
    "text",
    [
        "Senior React developer, Acme",
        failing_vacancy("budget_exceeded"),
        "fake-ai-fail: ai_timeout",
    ],
)
async def test_keeps_the_fixture_reply_without_a_known_marker(text: str) -> None:
    completion = await FakeAiProvider().complete(asking(text))

    assert json.loads(completion.text) == PARSED_VACANCY


async def test_keeps_a_scripted_reply_without_a_marker() -> None:
    fake = FakeAiProvider(replies=["scripted"])

    completion = await fake.complete(asking("Senior React developer, Acme"))

    assert (completion.text, fake.replies) == ("scripted", [])


async def test_reads_the_marker_inside_the_delimited_text_after_the_pii_scrub() -> None:
    request = VacancyParseRequest.model_validate(
        {"input": {"text": "Write to hr@acme.example fake-ai-fail:ai_provider_error"}}
    )
    prompt = scrub(vacancy_parse.build(request).user)

    with pytest.raises(AppError) as failed:
        await FakeAiProvider().complete(asking(prompt))

    assert (prompt, failed.value.status) == (
        "<vacancy_text>\nWrite to [email] fake-ai-fail:ai_provider_error\n</vacancy_text>",
        502,
    )
