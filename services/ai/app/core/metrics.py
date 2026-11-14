import time
from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import FastAPI
from prometheus_client import CollectorRegistry, Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.errors import AppError

VENDOR_CALL_SECONDS = Histogram(
    "jobflow_ai_vendor_call_seconds",
    "Vendor call time by kind, model and outcome (ok or the error)",
    ["kind", "model", "outcome"],
    registry=None,
)
TOKENS = Counter(
    "jobflow_ai_tokens_total",
    "Tokens the vendor counted by kind, model and direction (in, out)",
    ["kind", "model", "direction"],
    registry=None,
)
REPAIR_RETRIES = Counter(
    "jobflow_ai_repair_retries_total",
    "Second attempts after a schema or rules repair, by kind and model",
    ["kind", "model"],
    registry=None,
)
VENDOR_ERRORS = Counter(
    "jobflow_ai_vendor_errors_total",
    "Failed AI calls by kind, model and error",
    ["kind", "model", "error"],
    registry=None,
)
ERROR_NAMES = {
    504: "timeout",
    429: "rate_limited",
    502: "provider",
    422: "invalid_output",
}


def metrics_registry() -> CollectorRegistry:
    registry = CollectorRegistry()
    for collector in (VENDOR_CALL_SECONDS, TOKENS, REPAIR_RETRIES, VENDOR_ERRORS):
        registry.register(collector)
    return registry


def install_metrics(app: FastAPI) -> None:
    Instrumentator(
        excluded_handlers=["/metrics", "/health"], registry=metrics_registry()
    ).instrument(app).expose(app, include_in_schema=False)


def counted_error(kind: str, error: AppError, *, model: str) -> str:
    name = ERROR_NAMES.get(error.status, "other")
    VENDOR_ERRORS.labels(kind=kind, model=model, error=name).inc()
    return name


def count_tokens(kind: str, *, model: str, tokens_in: int, tokens_out: int) -> None:
    TOKENS.labels(kind=kind, model=model, direction="in").inc(tokens_in)
    TOKENS.labels(kind=kind, model=model, direction="out").inc(tokens_out)


@contextmanager
def timed_vendor_call(kind: str, *, model: str) -> Iterator[None]:
    started = time.perf_counter()
    outcome = "ok"
    try:
        yield
    except AppError as error:
        outcome = counted_error(kind, error, model=model)
        raise
    finally:
        VENDOR_CALL_SECONDS.labels(kind=kind, model=model, outcome=outcome).observe(
            time.perf_counter() - started
        )
