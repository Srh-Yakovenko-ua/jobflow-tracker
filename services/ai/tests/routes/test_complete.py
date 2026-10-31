import pytest

from app.providers.fake import FIXTURES, FakeAiProvider
from tests.factories import (
    PARSED_VACANCY,
    VACANCY_BODY,
    build_app,
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
        "promptVersion": "v1",
        "tokensIn": 100,
        "tokensOut": 50,
    }


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


async def test_answers_422_when_the_repaired_output_is_still_invalid() -> None:
    fake = FakeAiProvider(replies=["not json", '{"company": "Acme"}'])

    response = await post_completion(app=build_app(provider=fake))

    assert (response.status_code, len(fake.requests)) == (422, 2)
    assert response.json() == {
        "type": "validation_error",
        "title": "Invalid request",
        "status": 422,
        "detail": "The model output did not match the schema after one repair",
        "errors": [
            {"path": path, "message": "Field required"}
            for path in (
                "position",
                "location",
                "workMode",
                "salaryMin",
                "salaryMax",
                "currency",
                "stack",
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

    assert (response.status_code, response.json()["errors"]) == (
        422,
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


async def test_answers_429_once_the_service_limit_is_reached() -> None:
    app = build_app(settings=settings_for(ai_rate_limit_per_minute=1))

    first = await post_completion(app=app)
    second = await post_completion(app=app)

    assert (first.status_code, second.status_code, second.json()["type"]) == (
        200,
        429,
        "rate_limited",
    )
