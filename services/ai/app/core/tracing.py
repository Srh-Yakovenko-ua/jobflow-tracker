from typing import TYPE_CHECKING

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import Settings

if TYPE_CHECKING:
    from loguru import Record

EXPORT_TIMEOUT_SECONDS = 2.0


def install_tracing(app: FastAPI, settings: Settings) -> TracerProvider | None:
    collector = settings.otel_exporter_otlp_endpoint.rstrip("/")
    if collector == "":
        return None
    exporter = OTLPSpanExporter(
        endpoint=f"{collector}/v1/traces", timeout=EXPORT_TIMEOUT_SECONDS
    )
    tracer_provider = TracerProvider(resource=Resource.create({"service.name": "ai"}))
    tracer_provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(tracer_provider)
    FastAPIInstrumentor.instrument_app(
        app, tracer_provider=tracer_provider, excluded_urls="health,metrics"
    )
    return tracer_provider


def with_trace_ids(record: Record) -> None:
    active = trace.get_current_span().get_span_context()
    if active.is_valid:
        record["extra"].update(
            trace_id=trace.format_trace_id(active.trace_id),
            span_id=trace.format_span_id(active.span_id),
        )
