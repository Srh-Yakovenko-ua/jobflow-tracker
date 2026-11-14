import json

import pytest

from app.providers.fake import FIXTURES, FakeAiProvider
from tests.factories import (
    FOLLOWUP_FIXTURE,
    FOLLOWUP_PATH,
    MATCH_FIXTURE,
    MATCH_PATH,
    MONTHLY_SUMMARY_FIXTURE,
    MONTHLY_SUMMARY_PATH,
    PARSED_VACANCY,
    PII_RESUME,
    SCRUBBED_RESUME,
    UNNAMED_VACANCY,
    VACANCY_BODY,
    build_app,
    draft_of,
    failing_vacancy,
    followup_body,
    match_body,
    monthly_summary_request,
    post_as_worker,
    post_completion,
    settings_for,
    summary_of,
)

pytestmark = pytest.mark.anyio

FIXTURE_REPLY = (FIXTURES / "vacancy_parse.json").read_text()
FIXTURE_FOLLOWUP = (FIXTURES / "followup.json").read_text()
FIXTURE_SUMMARY = (FIXTURES / "monthly_summary.json").read_text()
INVENTED_SUMMARY = summary_of(ending=" 37 відгуків")

REPAIR_REQUEST = (
    "Your answer did not match the JSON schema: answer: Invalid JSON: expected value at line 1 column 1. "
    "Answer again with JSON that matches the schema."
)


def invalid_output(*, detail: str, errors: list[dict[str, str]]) -> dict[str, object]:
    return {
        "type": "ai_invalid_output",
        "title": "Invalid AI output",
        "status": 422,
        "detail": detail,
        "errors": errors,
        "requestId": "req-test",
    }


RULES_REPAIR = (
    "Your answer broke these rules: body has 5 words, it needs 60 to 120. "
    "Answer again with JSON that matches the schema and keeps every rule."
)
NUMBER_REPAIR = (
    "Your answer broke these rules: the number 37 is not in the input. "
    "Answer again with JSON that matches the schema and keeps every rule."
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


async def test_returns_the_followup_draft_at_temperature_0_4() -> None:
    fake = FakeAiProvider()

    response = await post_as_worker(
        FOLLOWUP_PATH, followup_body(), app=build_app(provider=fake)
    )

    body = response.json()
    assert isinstance(body.pop("latencyMs"), int)
    assert (response.status_code, body) == (
        200,
        {
            "output": FOLLOWUP_FIXTURE,
            "model": "fake",
            "promptVersion": "v1",
            "tokensIn": 100,
            "tokensOut": 50,
        },
    )
    assert (len(fake.requests), fake.requests[0].temperature) == (1, 0.4)


async def test_repairs_a_short_followup_draft_once_with_its_problems() -> None:
    fake = FakeAiProvider(replies=[draft_of(5), FIXTURE_FOLLOWUP])

    response = await post_as_worker(
        FOLLOWUP_PATH, followup_body(), app=build_app(provider=fake)
    )

    assert (response.status_code, response.json()["output"]) == (200, FOLLOWUP_FIXTURE)
    assert [
        (message.role, message.content) for message in fake.requests[1].messages[1:]
    ] == [("assistant", draft_of(5)), ("user", RULES_REPAIR)]


async def test_regenerates_a_monthly_summary_with_an_invented_number_once() -> None:
    fake = FakeAiProvider(replies=[INVENTED_SUMMARY, FIXTURE_SUMMARY])

    response = await post_as_worker(
        MONTHLY_SUMMARY_PATH, monthly_summary_request(), app=build_app(provider=fake)
    )

    body = response.json()
    assert (response.status_code, body["output"], body["promptVersion"]) == (
        200,
        MONTHLY_SUMMARY_FIXTURE,
        "v1",
    )
    assert [
        (message.role, message.content) for message in fake.requests[1].messages[1:]
    ] == [("assistant", INVENTED_SUMMARY), ("user", NUMBER_REPAIR)]
    assert (len(fake.requests), fake.requests[0].temperature) == (2, 0.3)


@pytest.mark.parametrize(
    ("path", "body", "replies", "problem"),
    [
        pytest.param(
            FOLLOWUP_PATH,
            followup_body(),
            [draft_of(5), draft_of(50)],
            "body has 50 words, it needs 60 to 120",
            id="followup_still_short",
        ),
        pytest.param(
            MONTHLY_SUMMARY_PATH,
            monthly_summary_request(),
            [INVENTED_SUMMARY, INVENTED_SUMMARY],
            "the number 37 is not in the input",
            id="monthly_summary_keeps_the_number",
        ),
    ],
)
async def test_answers_invalid_output_when_the_repaired_answer_still_breaks_a_rule(
    *, path: str, body: object, replies: list[str], problem: str
) -> None:
    fake = FakeAiProvider(replies=replies)

    response = await post_as_worker(path, body, app=build_app(provider=fake))

    assert (response.status_code, len(fake.requests)) == (422, 2)
    assert response.json() == invalid_output(
        detail="The model output broke the kind's rules after one repair",
        errors=[{"path": "output", "message": problem}],
    )


async def test_answers_504_for_a_followup_hint_with_the_timeout_marker() -> None:
    response = await post_as_worker(
        FOLLOWUP_PATH, followup_body(hint="fake-ai-fail:ai_timeout")
    )

    assert (response.status_code, response.json()["type"]) == (504, "ai_timeout")


async def test_answers_401_for_a_followup_without_the_service_token() -> None:
    response = await post_as_worker(
        FOLLOWUP_PATH, followup_body(), headers={"x-request-id": "req-test"}
    )

    assert (response.status_code, response.json()["type"]) == (401, "unauthorized")


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
    assert response.json() == invalid_output(
        detail="The model output did not match the schema after one repair",
        errors=[
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
    )


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
