from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from app.factory import create_app
from tests.factories import REQUIRED_ENV, serving, settings_for


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (*REQUIRED_ENV, "LOG_LEVEL", "OTEL_EXPORTER_OTLP_ENDPOINT"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture(scope="session")
def span_recorder() -> InMemorySpanExporter:
    recorder = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(recorder))
    trace.set_tracer_provider(provider)
    return recorder


@pytest.fixture
def spans(span_recorder: InMemorySpanExporter) -> InMemorySpanExporter:
    span_recorder.clear()
    return span_recorder


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with serving(create_app(settings_for())) as client:
        yield client
