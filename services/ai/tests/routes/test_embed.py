import pytest

from app.providers.anthropic import AnthropicProvider
from app.providers.fake import FakeAiProvider
from tests.factories import VENDOR, build_app, post_as_worker

pytestmark = pytest.mark.anyio

EMBED_PATH = "/v1/embed"


async def test_returns_one_deterministic_vector_per_text_from_the_fake() -> None:
    response = await post_as_worker(
        EMBED_PATH,
        {"texts": ["React developer", "React developer", "Go"], "inputType": "query"},
    )

    body = response.json()
    vectors = body.pop("vectors")
    assert (response.status_code, isinstance(body.pop("latencyMs"), int), body) == (
        200,
        True,
        {"model": "fake", "tokensIn": 5},
    )
    assert [len(vector) for vector in vectors] == [32, 32, 32]
    assert vectors[0] == vectors[1] != vectors[2]
    assert all(0 <= value <= 1 for value in vectors[2])


async def test_scrubs_emails_and_phones_before_embedding() -> None:
    fake = FakeAiProvider()

    await post_as_worker(
        EMBED_PATH,
        {
            "texts": ["Mail hr@acme.example, call +380 67 123 45 67"],
            "inputType": "passage",
        },
        app=build_app(provider=fake),
    )

    assert [text.root for text in fake.embed_requests[0].texts] == [
        "Mail [email], call [phone]"
    ]


async def test_answers_501_when_the_provider_has_no_embeddings() -> None:
    response = await post_as_worker(
        EMBED_PATH,
        {"texts": ["React"], "inputType": "query"},
        app=build_app(provider=AnthropicProvider(VENDOR)),
    )

    assert (response.status_code, response.json()) == (
        501,
        {
            "type": "not_implemented",
            "title": "Not implemented",
            "status": 501,
            "detail": "Anthropic has no embeddings API",
            "requestId": "req-test",
        },
    )


async def test_answers_422_with_paths_for_an_invalid_embed_request() -> None:
    response = await post_as_worker(EMBED_PATH, {"texts": [], "inputType": "document"})

    assert (
        response.status_code,
        [error["path"] for error in response.json()["errors"]],
    ) == (
        422,
        ["texts", "inputType"],
    )


async def test_answers_401_without_a_service_token() -> None:
    response = await post_as_worker(
        EMBED_PATH, {"texts": ["React"], "inputType": "query"}, headers={}
    )

    assert (response.status_code, response.json()["type"]) == (401, "unauthorized")
