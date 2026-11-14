from collections.abc import Awaitable

import pytest

from app.core.metrics import metrics_registry
from app.providers.fake import FakeAiProvider
from app.providers.openai import OpenAiProvider
from tests.factories import (
    ScriptedVendor,
    build_app,
    client_of,
    post_completion,
    retry_soon,
    settings_for,
    vendor_settings,
)

pytestmark = pytest.mark.anyio

Series = tuple[str, dict[str, str]]

VACANCY_TOKENS: list[Series] = [
    (
        "jobflow_ai_tokens_total",
        {"kind": "vacancy_parse", "model": "fake", "direction": direction},
    )
    for direction in ("in", "out")
]
REPAIR_RETRY = (
    "jobflow_ai_repair_retries_total",
    {"kind": "vacancy_parse", "model": "fake"},
)


def vendor_error(error: str, *, model: str = "fake") -> Series:
    return (
        "jobflow_ai_vendor_errors_total",
        {"kind": "vacancy_parse", "model": model, "error": error},
    )


def read(series: list[Series]) -> list[float]:
    registry = metrics_registry()
    return [registry.get_sample_value(name, labels) or 0.0 for name, labels in series]


async def rise_of(series: list[Series], call: Awaitable[object]) -> list[float]:
    before = read(series)
    await call
    return [after - start for after, start in zip(read(series), before, strict=True)]


async def test_serves_metrics_without_the_service_token() -> None:
    async with client_of(build_app()) as client:
        response = await client.get("/metrics")

    assert (response.status_code, response.headers["content-type"]) == (
        200,
        "text/plain; version=1.0.0; charset=utf-8",
    )


async def test_counts_the_tokens_of_a_completion_by_kind_model_and_direction() -> None:
    rise = await rise_of(VACANCY_TOKENS, post_completion())

    assert rise == [100.0, 50.0]


async def test_counts_one_repair_retry_and_the_tokens_of_both_answers() -> None:
    fake = FakeAiProvider(replies=["Sure, here is the vacancy"])

    rise = await rise_of(
        [*VACANCY_TOKENS, REPAIR_RETRY], post_completion(app=build_app(provider=fake))
    )

    assert rise == [200.0, 100.0, 1.0]


async def test_counts_invalid_output_once_the_repair_is_still_invalid() -> None:
    fake = FakeAiProvider(replies=["not json", "still not json"])

    rise = await rise_of(
        [REPAIR_RETRY, vendor_error("invalid_output")],
        post_completion(app=build_app(provider=fake)),
    )

    assert rise == [1.0, 1.0]


async def test_counts_a_vendor_timeout_and_times_the_call_as_timed_out() -> None:
    app = build_app(
        settings=settings_for(ai_timeout_seconds=0.05),
        provider=FakeAiProvider(delay_seconds=5),
    )
    timed_out = (
        "jobflow_ai_vendor_call_seconds_count",
        {"kind": "vacancy_parse", "model": "fake", "outcome": "timeout"},
    )

    rise = await rise_of(
        [vendor_error("timeout"), timed_out, VACANCY_TOKENS[0]],
        post_completion(app=app),
    )

    assert rise == [1.0, 1.0, 0.0]


async def test_counts_a_failed_vendor_call_by_the_model_it_asked_for() -> None:
    vendor = ScriptedVendor([retry_soon(500)])
    provider = OpenAiProvider(vendor_settings(), http_client=vendor.client())
    failed = (
        "jobflow_ai_vendor_call_seconds_count",
        {"kind": "vacancy_parse", "model": "test-model", "outcome": "provider"},
    )

    rise = await rise_of(
        [vendor_error("provider", model="test-model"), failed],
        post_completion(app=build_app(provider=provider)),
    )

    assert rise == [1.0, 1.0]
