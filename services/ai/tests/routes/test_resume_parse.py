import pytest

from app.providers.fake import FakeAiProvider
from tests.factories import (
    PII_RESUME,
    PROFILED_RESUME,
    RESUME_PAGE,
    RESUME_PATH,
    SCRUBBED_RESUME,
    build_app,
    post_as_worker,
    resume_body,
    settings_for,
)

pytestmark = pytest.mark.anyio

SCAN_BODY = resume_body(text="", pages=[RESUME_PAGE])


async def test_returns_the_profile_with_years_computed_from_the_positions() -> None:
    response = await post_as_worker(RESUME_PATH, resume_body())

    body = response.json()
    assert isinstance(body.pop("latencyMs"), int)
    assert (response.status_code, body) == (
        200,
        {
            "output": PROFILED_RESUME,
            "model": "fake",
            "promptVersion": "v1",
            "tokensIn": 100,
            "tokensOut": 50,
        },
    )


async def test_scrubs_contacts_and_address_from_the_resume_text() -> None:
    fake = FakeAiProvider()

    response = await post_as_worker(
        RESUME_PATH, resume_body(text=PII_RESUME), app=build_app(provider=fake)
    )

    assert (response.status_code, fake.requests[0].messages[0].content) == (
        200,
        f"<resume_text>\n{SCRUBBED_RESUME}\n</resume_text>",
    )


async def test_refuses_a_scan_as_needs_text_without_a_vision_model() -> None:
    fake = FakeAiProvider()

    response = await post_as_worker(
        RESUME_PATH, SCAN_BODY, app=build_app(provider=fake)
    )

    assert (response.status_code, response.json(), fake.requests) == (
        422,
        {
            "type": "needs_text",
            "title": "Text needed",
            "status": 422,
            "detail": "Scanned pages need a vision model",
            "requestId": "req-test",
        },
        [],
    )


async def test_sends_scan_pages_to_the_model_when_a_vision_model_is_set() -> None:
    fake = FakeAiProvider()
    app = build_app(settings=settings_for(ai_vision_model="vision-test"), provider=fake)

    response = await post_as_worker(RESUME_PATH, SCAN_BODY, app=app)

    message = fake.requests[0].messages[0]
    assert (response.status_code, response.json()["output"]) == (200, PROFILED_RESUME)
    assert (message.images, message.content) == (
        (RESUME_PAGE,),
        "The resume is in the attached page images, in page order.",
    )
