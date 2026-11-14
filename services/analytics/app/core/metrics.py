from fastapi import FastAPI
from prometheus_client import CollectorRegistry, Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

CACHE_LOOKUPS = Counter(
    "analytics_cache_lookups_total",
    "Analytics cache lookups by metric and result (hit, miss, bypass)",
    ["metric", "result"],
    registry=None,
)
METRIC_COMPUTE_SECONDS = Histogram(
    "analytics_metric_compute_seconds",
    "Time spent computing an analytics metric on a cache miss or bypass",
    ["metric"],
    registry=None,
)
UNOBSERVED_HANDLERS = ["/metrics", "/health"]


def metrics_registry() -> CollectorRegistry:
    registry = CollectorRegistry()
    registry.register(CACHE_LOOKUPS)
    registry.register(METRIC_COMPUTE_SECONDS)
    return registry


def install_metrics(app: FastAPI) -> None:
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        excluded_handlers=UNOBSERVED_HANDLERS,
        registry=metrics_registry(),
    )
    instrumentator.instrument(app).expose(app, include_in_schema=False)
