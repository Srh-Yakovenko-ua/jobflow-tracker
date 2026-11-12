import json

import pytest

from app.providers.fake import FIXTURES, FakeAiProvider
from tests.factories import (
    MATCH_FIXTURE,
    MATCH_PATH,
    PARSED_VACANCY,
    PII_RESUME,
    SCRUBBED_RESUME,
    UNNAMED_VACANCY,
    VACANCY_BODY,
    build_app,
    failing_vacancy,
    match_body,
    post_as_worker,
    post_completion,
    settings_for,
)

pytestmark = pytest.mark.anyio

FIXTURE_REPLY = (FIXTURES / "vacancy_parse.json").read_text()

REPAIR_REQUEST = (
    "Your answer did not match the JSON schema: answer: Invalid JSON: expected value at line 1 column 1. "
    "Answer again with JSON that matches the schema."
)


async def test_returns_the_fixture_output_with_model_and_prompt_version() -> None:
    response = await post_completion()

    body = response.json()
    assert (response.status_code, response.headers["x-request-id"]) == (200, "req-test")
    assert isinstance(body.pop("latencyMs"), int)
    assert body == {
        "output": PARSED_VACANCY,
        "model": "fake",
        "promptVersion": "v2",
        "tokensIn": 100,
        "tokensOut": 50,
    }


async def test_returns_the_match_requirements_without_a_score() -> None:
    fake = FakeAiProvider()

    response = await post_as_worker(
        MATCH_PATH, match_body(), app=build_app(provider=fake)
    )

    body = response.json()
    assert isinstance(body.pop("latencyMs"), int)
    assert (response.status_code, body, fake.requests[0].kind) == (
        200,
        {
            "output": MATCH_FIXTURE,
            "model": "fake",
            "promptVersion": "v3",
            "tokensIn": 100,
            "tokensOut": 50,
        },
        "match",
    )


async def test_marks_an_invented_company_check_when_the_text_lacks_its_quote() -> None:
    invented = {"value": "Globex", "confidence": "exact", "evidence": "Globex"}
    fake = FakeAiProvider(replies=[json.dumps({**PARSED_VACANCY, "company": invented})])

    response = await post_completion(app=build_app(provider=fake))

    assert (response.status_code, response.json()["output"]) == (
        200,
        {**PARSED_VACANCY, "company": {**invented, "confidence": "check"}},
    )


async def test_repairs_invalid_json_with_one_more_call_and_sums_the_tokens() -> None:
    fake = FakeAiProvider(replies=["Sure, here is the vacancy", FIXTURE_REPLY])

    response = await post_completion(app=build_app(provider=fake))

    body = response.json()
    assert (
        response.status_code,
        body["output"],
        body["tokensIn"],
        body["tokensOut"],
    ) == (200, PARSED_VACANCY, 200, 100)
    assert len(fake.requests) == 2
    assert [
        (message.role, message.content) for message in fake.requests[1].messages[1:]
    ] == [
        ("assistant", "Sure, here is the vacancy"),
        ("user", REPAIR_REQUEST),
    ]


async def test_answers_invalid_output_when_the_repair_is_still_invalid() -> None:
    only_company = json.dumps({"company": PARSED_VACANCY["company"]})
    fake = FakeAiProvider(replies=["not json", only_company])

    response = await post_completion(app=build_app(provider=fake))

    assert (response.status_code, len(fake.requests)) == (422, 2)
    assert response.json() == {
        "type": "ai_invalid_output",
        "title": "Invalid AI output",
        "status": 422,
        "detail": "The model output did not match the schema after one repair",
        "errors": [
            {"path": path, "message": "Field required"}
            for path in (
                "position",
                "seniority",
                "salaryMin",
                "salaryMax",
                "currency",
                "salaryTax",
                "location",
                "workMode",
                "stack",
                "requirements",
                "englishLevel",
                "sourceGuess",
            )
        ],
        "requestId": "req-test",
    }


async def test_answers_504_when_the_model_does_not_answer_in_time() -> None:
    app = build_app(
        settings=settings_for(ai_timeout_seconds=0.05),
        provider=FakeAiProvider(delay_seconds=5),
    )

    response = await post_completion(app=app)

    assert (response.status_code, response.json()) == (
        504,
        {
            "type": "ai_timeout",
            "title": "AI timeout",
            "status": 504,
            "detail": "The model did not answer within 0.05 seconds",
            "requestId": "req-test",
        },
    )


@pytest.mark.parametrize(
    ("failure", "problem"),
    [
        (
            "ai_timeout",
            {
                "type": "ai_timeout",
                "title": "AI timeout",
                "status": 504,
                "detail": "The model did not answer within 30 seconds",
            },
        ),
        (
            "ai_provider_error",
            {
                "type": "ai_provider_error",
                "title": "AI provider error",
                "status": 502,
                "detail": "The AI provider failed",
            },
        ),
    ],
)
async def test_fails_the_way_a_vendor_does_for_a_fake_failure_marker(
    *, failure: str, problem: dict[str, object]
) -> None:
    response = await post_completion({"input": {"text": failing_vacancy(failure)}})

    assert (response.status_code, response.json()) == (
        problem["status"],
        {**problem, "requestId": "req-test"},
    )


async def test_answers_200_without_company_and_position_for_their_marker() -> None:
    response = await post_completion(
        {"input": {"text": failing_vacancy("no_company_no_position")}}
    )

    assert (response.status_code, response.json()["output"]) == (200, UNNAMED_VACANCY)


async def test_answers_404_for_an_unknown_kind() -> None:
    response = await post_as_worker("/v1/complete/horoscope", VACANCY_BODY)

    assert (response.status_code, response.json()) == (
        404,
        {
            "type": "not_found",
            "title": "Not found",
            "status": 404,
            "detail": "Unknown AI kind",
            "requestId": "req-test",
        },
    )


async def test_answers_422_with_paths_for_an_invalid_kind_input() -> None:
    response = await post_completion({"input": {"text": "   "}, "maxTokens": 0})

    body = response.json()
    assert (response.status_code, body["type"], body["errors"]) == (
        422,
        "validation_error",
        [
            {
                "path": "maxTokens",
                "message": "Input should be greater than or equal to 1",
            },
            {"path": "input.text", "message": "String should match pattern '\\S'"},
        ],
    )


async def test_scrubs_emails_and_phones_from_every_message_sent_to_the_model() -> None:
    fake = FakeAiProvider(replies=["Mail jane.doe@example.com", FIXTURE_REPLY])
    body = {
        "input": {
            "text": "Acme hires. Write to hr@acme.example or call +380 67 123 45 67"
        }
    }

    response = await post_completion(body, app=build_app(provider=fake))

    assert response.status_code == 200
    assert fake.requests[0].messages[0].content == (
        "<vacancy_text>\nAcme hires. Write to [email] or call [phone]\n</vacancy_text>"
    )
    assert fake.requests[1].messages[1].content == "Mail [email]"


async def test_scrubs_a_resume_before_the_model_sees_it() -> None:
    fake = FakeAiProvider()

    response = await post_completion(
        {"input": {"text": PII_RESUME}}, app=build_app(provider=fake)
    )

    assert (response.status_code, fake.requests[0].messages[0].content) == (
        200,
        f"<vacancy_text>\n{SCRUBBED_RESUME}\n</vacancy_text>",
    )


async def test_answers_429_once_the_service_limit_is_reached() -> None:
    app = build_app(settings=settings_for(ai_rate_limit_per_minute=1))

    first = await post_completion(app=app)
    second = await post_completion(app=app)

    assert (first.status_code, second.status_code, second.json()["type"]) == (
        200,
        429,
        "rate_limited",
    )
