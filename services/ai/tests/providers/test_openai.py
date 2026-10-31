import httpx2
import pytest

from app.contracts.embed_request import EmbedRequest
from app.core.errors import AppError
from app.providers.base import Completion
from app.providers.openai import OpenAiProvider
from tests.factories import (
    COMPLETION_REQUEST,
    VACANCY_PROMPT,
    ScriptedVendor,
    chat_completion,
    vendor_settings,
)

pytestmark = pytest.mark.anyio

NVIDIA = vendor_settings(base_url="https://integrate.api.nvidia.com/v1", nvidia=True)

CHAT_BODY = {
    "model": "test-model",
    "messages": [
        {"role": "system", "content": "Extract the vacancy."},
        {"role": "user", "content": VACANCY_PROMPT},
    ],
    "response_format": {
        "type": "json_schema",
        "json_schema": {
            "name": "vacancy_parse",
            "strict": False,
            "schema": {"type": "object"},
        },
    },
    "temperature": 0.0,
    "max_tokens": 64,
}


async def test_asks_openai_for_the_kind_json_schema() -> None:
    vendor = ScriptedVendor([chat_completion('{"company": "Acme"}')])

    completion = await OpenAiProvider(
        vendor_settings(), http_client=vendor.client()
    ).complete(COMPLETION_REQUEST)

    assert str(vendor.seen[0].url) == "https://api.openai.com/v1/chat/completions"
    assert vendor.seen[0].headers["authorization"] == "Bearer test-key"
    assert vendor.bodies() == [CHAT_BODY]
    assert completion == Completion(
        text='{"company": "Acme"}', model="test-model", tokens_in=11, tokens_out=7
    )


async def test_turns_nvidia_reasoning_off_and_strips_a_thinking_block() -> None:
    vendor = ScriptedVendor(
        [chat_completion('<think>Acme is the company</think>\n{"company": "Acme"}')]
    )

    completion = await OpenAiProvider(NVIDIA, http_client=vendor.client()).complete(
        COMPLETION_REQUEST
    )

    assert (
        str(vendor.seen[0].url)
        == "https://integrate.api.nvidia.com/v1/chat/completions"
    )
    assert vendor.bodies() == [CHAT_BODY | {"reasoning_effort": "none"}]
    assert completion.text == '{"company": "Acme"}'


async def test_sends_the_nvidia_input_type_with_an_embedding_request() -> None:
    vendor = ScriptedVendor(
        [
            httpx2.Response(
                200,
                json={
                    "object": "list",
                    "model": "test-embed",
                    "data": [
                        {"object": "embedding", "index": 0, "embedding": [0.25, 0.5]}
                    ],
                    "usage": {"prompt_tokens": 3, "total_tokens": 3},
                },
            )
        ]
    )
    request = EmbedRequest.model_validate(
        {"texts": ["React developer"], "inputType": "passage"}
    )

    embedding = await OpenAiProvider(NVIDIA, http_client=vendor.client()).embed(request)

    assert vendor.bodies() == [
        {
            "model": "test-embed",
            "input": ["React developer"],
            "encoding_format": "float",
            "input_type": "passage",
        }
    ]
    assert (embedding.vectors, embedding.model, embedding.tokens_in) == (
        [[0.25, 0.5]],
        "test-embed",
        3,
    )


async def test_answers_501_for_embeddings_when_no_embedding_model_is_set() -> None:
    vendor = ScriptedVendor([chat_completion("{}")])
    request = EmbedRequest.model_validate({"texts": ["React"], "inputType": "query"})

    with pytest.raises(AppError) as refused:
        await OpenAiProvider(
            vendor_settings(embedding_model=""), http_client=vendor.client()
        ).embed(request)

    assert (refused.value.status, vendor.seen) == (501, [])
