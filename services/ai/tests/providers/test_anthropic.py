import pytest

from app.contracts.embed_request import EmbedRequest
from app.core.errors import AppError
from app.providers.anthropic import AnthropicProvider
from app.providers.base import Completion
from tests.factories import (
    COMPLETION_REQUEST,
    VACANCY_PROMPT,
    ScriptedVendor,
    anthropic_message,
    vendor_settings,
)

pytestmark = pytest.mark.anyio


async def test_forces_a_tool_call_with_the_kind_json_schema() -> None:
    vendor = ScriptedVendor([anthropic_message({"company": "Acme"})])

    completion = await AnthropicProvider(
        vendor_settings(), http_client=vendor.client()
    ).complete(COMPLETION_REQUEST)

    assert str(vendor.seen[0].url) == "https://api.anthropic.com/v1/messages"
    assert vendor.seen[0].headers["x-api-key"] == "test-key"
    assert vendor.bodies() == [
        {
            "model": "test-model",
            "max_tokens": 64,
            "system": "Extract the vacancy.",
            "messages": [{"role": "user", "content": VACANCY_PROMPT}],
            "tools": [
                {
                    "name": "submit_vacancy_parse",
                    "description": "Submit the vacancy_parse result.",
                    "input_schema": {"type": "object"},
                }
            ],
            "tool_choice": {"type": "tool", "name": "submit_vacancy_parse"},
            "temperature": 0.0,
        }
    ]
    assert completion == Completion(
        text='{"company": "Acme"}', model="test-model", tokens_in=11, tokens_out=7
    )


async def test_answers_501_for_embeddings_anthropic_does_not_offer() -> None:
    vendor = ScriptedVendor([anthropic_message({})])
    request = EmbedRequest.model_validate({"texts": ["React"], "inputType": "query"})

    with pytest.raises(AppError) as refused:
        await AnthropicProvider(vendor_settings(), http_client=vendor.client()).embed(
            request
        )

    assert (refused.value.status, vendor.seen) == (501, [])
