from collections.abc import Callable

import httpx2
import pytest

from app.core.errors import AppError
from app.providers.anthropic import AnthropicProvider
from app.providers.openai import OpenAiProvider
from tests.factories import (
    COMPLETION_REQUEST,
    ScriptedVendor,
    anthropic_message,
    chat_completion,
    retry_soon,
    vendor_settings,
)

pytestmark = pytest.mark.anyio

type ProviderClass = type[AnthropicProvider | OpenAiProvider]

PROVIDERS = [
    pytest.param(AnthropicProvider, id="anthropic"),
    pytest.param(OpenAiProvider, id="openai"),
]

ANSWERS: dict[ProviderClass, Callable[[], httpx2.Response]] = {
    AnthropicProvider: lambda: anthropic_message({"company": "Acme"}),
    OpenAiProvider: lambda: chat_completion('{"company": "Acme"}'),
}


@pytest.mark.parametrize("provider_class", PROVIDERS)
async def test_the_sdk_retries_a_429_and_returns_the_next_answer(
    provider_class: ProviderClass,
) -> None:
    vendor = ScriptedVendor([retry_soon(429), ANSWERS[provider_class]()])

    completion = await provider_class(
        vendor_settings(), http_client=vendor.client()
    ).complete(COMPLETION_REQUEST)

    assert (completion.text, len(vendor.seen)) == ('{"company": "Acme"}', 2)


@pytest.mark.parametrize("provider_class", PROVIDERS)
@pytest.mark.parametrize(
    ("vendor_status", "status", "detail"),
    [
        (429, 429, "The AI provider is rate limiting"),
        (500, 502, "The AI provider failed"),
    ],
)
async def test_maps_the_vendor_error_left_after_the_retries(
    *, provider_class: ProviderClass, vendor_status: int, status: int, detail: str
) -> None:
    vendor = ScriptedVendor([retry_soon(vendor_status)])

    with pytest.raises(AppError) as failed:
        await provider_class(vendor_settings(), http_client=vendor.client()).complete(
            COMPLETION_REQUEST
        )

    assert (failed.value.status, failed.value.detail, len(vendor.seen)) == (
        status,
        detail,
        3,
    )


@pytest.mark.parametrize("provider_class", PROVIDERS)
async def test_maps_an_sdk_timeout_to_504(provider_class: ProviderClass) -> None:
    def time_out(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ReadTimeout("no answer", request=request)

    client = httpx2.AsyncClient(transport=httpx2.MockTransport(time_out))

    with pytest.raises(AppError) as failed:
        await provider_class(
            vendor_settings(max_retries=0), http_client=client
        ).complete(COMPLETION_REQUEST)

    assert (failed.value.status, failed.value.detail) == (
        504,
        "The model did not answer within 5 seconds",
    )
