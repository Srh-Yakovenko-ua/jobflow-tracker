from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import TYPE_CHECKING

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import Settings

if TYPE_CHECKING:
    from loguru import Record

EXPORT_TIMEOUT_SECONDS = 2.0
UNTRACED_PATHS = "health,metrics"
METRIC_SPAN = "analytics.metric"


@dataclass
class RowCount:
    rows: int = 0


METRIC_ROWS: ContextVar[RowCount | None] = ContextVar("metric_rows", default=None)
tracer = trace.get_tracer("analytics")


def install_tracing(app: FastAPI, *, engine: AsyncEngine, settings: Settings) -> None:
    endpoint = settings.otel_exporter_otlp_endpoint.rstrip("/")
    if not endpoint:
        return
    provider = TracerProvider(resource=Resource.create({"service.name": "analytics"}))
    exporter = OTLPSpanExporter(
        endpoint=f"{endpoint}/v1/traces", timeout=EXPORT_TIMEOUT_SECONDS
    )
    provider.add_span_processor(
        BatchSpanProcessor(
            exporter, export_timeout_millis=EXPORT_TIMEOUT_SECONDS * 1000
        )
    )
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(
        app, tracer_provider=provider, excluded_urls=UNTRACED_PATHS
    )
    SQLAlchemyInstrumentor().instrument(
        engine=engine.sync_engine, tracer_provider=provider
    )
    AsyncPGInstrumentor().instrument(tracer_provider=provider)


def with_trace_ids(record: Record) -> None:
    context = trace.get_current_span().get_span_context()
    if context.is_valid:
        record["extra"]["trace_id"] = trace.format_trace_id(context.trace_id)
        record["extra"]["span_id"] = trace.format_span_id(context.span_id)


@contextmanager
def metric_span(name: str) -> Iterator[None]:
    count = RowCount()
    token = METRIC_ROWS.set(count)
    attributes = {"analytics.metric.name": name}
    with tracer.start_as_current_span(METRIC_SPAN, attributes=attributes) as span:
        try:
            yield
        finally:
            span.set_attribute("analytics.metric.rows", count.rows)
            METRIC_ROWS.reset(token)


def count_rows(rows: int) -> None:
    count = METRIC_ROWS.get()
    if count is not None:
        count.rows += rows
