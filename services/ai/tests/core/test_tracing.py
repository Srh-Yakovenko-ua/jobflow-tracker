import json
import time

import pytest
from loguru import logger
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import NonRecordingSpan, SpanContext

from app.core.logging import configure_logging
from app.core.tracing import EXPORT_TIMEOUT_SECONDS, install_tracing
from tests.factories import auth_headers, build_app, post_completion, settings_for

CALLER_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
CALLER_SPAN_ID = "00f067aa0ba902b7"
TRACEPARENT = f"00-{CALLER_TRACE_ID}-{CALLER_SPAN_ID}-01"


@pytest.fixture(scope="session")
def finished_spans() -> InMemorySpanExporter:
    memory = InMemorySpanExporter()
    session_provider = TracerProvider()
    session_provider.add_span_processor(SimpleSpanProcessor(memory))
    trace.set_tracer_provider(session_provider)
    return memory


def collector_at(port: int) -> str:
    return f"http://127.0.0.1:{port}"


@pytest.mark.anyio
async def test_records_the_model_call_in_the_workers_trace_without_the_input_text(
    *, closed_port: int, finished_spans: InMemorySpanExporter
) -> None:
    app = build_app(
        settings=settings_for(otel_exporter_otlp_endpoint=collector_at(closed_port))
    )

    response = await post_completion(
        app=app, headers=auth_headers() | {"traceparent": TRACEPARENT}
    )

    in_caller_trace = [
        (span.name, dict(span.attributes or {}))
        for span in finished_spans.get_finished_spans()
        if span.context is not None
        and trace.format_trace_id(span.context.trace_id) == CALLER_TRACE_ID
    ]
    assert response.status_code == 200
    assert in_caller_trace == [
        (
            "ai.complete",
            {
                "jobflow.ai.kind": "vacancy_parse",
                "gen_ai.response.model": "fake",
                "gen_ai.usage.input_tokens": 100,
                "gen_ai.usage.output_tokens": 50,
            },
        )
    ]


def test_writes_trace_ids_into_a_serialized_log_line_only_inside_a_span(
    capsys: pytest.CaptureFixture[str],
) -> None:
    caller = SpanContext(
        trace_id=int(CALLER_TRACE_ID, 16),
        span_id=int(CALLER_SPAN_ID, 16),
        is_remote=True,
    )
    configure_logging("INFO")
    with trace.use_span(NonRecordingSpan(caller)):
        logger.info("inside a span")
    logger.info("outside a span")

    lines = [
        json.loads(line)["record"] for line in capsys.readouterr().err.splitlines()
    ]
    assert [(line["message"], line["extra"]) for line in lines] == [
        ("inside a span", {"trace_id": CALLER_TRACE_ID, "span_id": CALLER_SPAN_ID}),
        ("outside a span", {}),
    ]


@pytest.mark.anyio
@pytest.mark.usefixtures("finished_spans")
@pytest.mark.parametrize("port_fixture", ["closed_port", "silent_port"])
async def test_answers_and_settles_the_export_in_time_when_the_collector_is_down(
    request: pytest.FixtureRequest, port_fixture: str
) -> None:
    app = build_app()
    endpoint = collector_at(request.getfixturevalue(port_fixture))
    provider = install_tracing(app, settings_for(otel_exporter_otlp_endpoint=endpoint))
    assert provider is not None

    response = await post_completion(app=app)
    flushing = time.monotonic()
    provider.force_flush()
    flushed_in = time.monotonic() - flushing
    provider.shutdown()

    assert response.status_code == 200
    assert flushed_in < EXPORT_TIMEOUT_SECONDS + 1
