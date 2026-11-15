import time
from dataclasses import dataclass
from typing import Any

import pytest
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pydantic import TypeAdapter

from app.core.config import DEPENDENCY_LIMITS
from app.core.metrics import metrics_registry
from app.core.resources import create_redis
from app.core.tracing import count_rows
from app.metrics.norms import Norms
from app.services.metric_cache import CacheScope, cached_body
from tests.factories import (
    OUTAGES,
    USER_ID,
    Outage,
    application,
    moves,
    settings_for,
    stage_events_frame,
)
from tests.services.test_cache import Computation, FakeRedis

pytestmark = pytest.mark.anyio

PARAMS_HASH = "5f0c2a9e41b7d3c8"
SCOPE = CacheScope(user_id=USER_ID, metric="funnel", params_hash=PARAMS_HASH)
VERSION_KEY = f"analytics:{USER_ID}:version"
COMPUTED_BODY = b'{"stageNormDays":{"final":17},"medianDaysToOffer":null}'
STORED_BODY = b'{"stageNormDays":{"final":99},"medianDaysToOffer":1}'
REGISTRY = metrics_registry()
LOOKUP_RESULTS = ["hit", "miss", "bypass"]


def entry(version: int) -> str:
    return f"analytics:{USER_ID}:v{version}:funnel:{PARAMS_HASH}"


async def body_of(redis: Any, compute: Computation) -> bytes:
    return await cached_body(
        redis, scope=SCOPE, adapter=TypeAdapter(Norms), compute=compute
    )


def tally() -> dict[str, float]:
    lookups = {
        result: REGISTRY.get_sample_value(
            "analytics_cache_lookups_total", {"metric": "funnel", "result": result}
        )
        for result in LOOKUP_RESULTS
    }
    computes = REGISTRY.get_sample_value(
        "analytics_metric_compute_seconds_count", {"metric": "funnel"}
    )
    return {
        name: value or 0.0 for name, value in (lookups | {"computes": computes}).items()
    }


async def counted(redis: Any, compute: Computation) -> tuple[bytes, dict[str, float]]:
    before = tally()
    body = await body_of(redis, compute)
    return body, {name: value - before[name] for name, value in tally().items()}


LOOKUPS = {
    "hit": (
        {VERSION_KEY: b"3", entry(3): STORED_BODY},
        (STORED_BODY, {"hit": 1.0, "miss": 0.0, "bypass": 0.0, "computes": 0.0}),
    ),
    "miss": (
        {},
        (COMPUTED_BODY, {"hit": 0.0, "miss": 1.0, "bypass": 0.0, "computes": 1.0}),
    ),
}


@pytest.mark.parametrize(
    ("bodies", "expected"), list(LOOKUPS.values()), ids=list(LOOKUPS)
)
async def test_counts_each_lookup_by_result_and_times_only_the_computation(
    bodies: dict[str, bytes], expected: tuple[bytes, dict[str, float]]
) -> None:
    assert await counted(FakeRedis(dict(bodies)), Computation()) == expected


READ_FRAMES = [
    stage_events_frame(moves(application(0), ["applied", "screening", "offer"])),
    stage_events_frame(moves(application(1), ["applied", "rejected"])),
]


@dataclass
class FrameReads(Computation):
    async def __call__(self) -> Norms:
        for frame in READ_FRAMES:
            count_rows(len(frame))
        return await super().__call__()


METRIC_SPANS = {
    "miss": [
        (
            "analytics.metric",
            {"analytics.metric.name": "funnel", "analytics.metric.rows": 5},
        )
    ],
    "hit": [],
}


@pytest.mark.parametrize(
    ("bodies", "expected"),
    [(LOOKUPS[lookup][0], recorded) for lookup, recorded in METRIC_SPANS.items()],
    ids=list(METRIC_SPANS),
)
async def test_records_a_metric_span_with_the_rows_read_only_when_it_computes(
    *,
    spans: InMemorySpanExporter,
    bodies: dict[str, bytes],
    expected: list[tuple[str, dict[str, Any]]],
) -> None:
    await body_of(FakeRedis(dict(bodies)), FrameReads())

    recorded = spans.get_finished_spans()
    assert [(span.name, dict(span.attributes or {})) for span in recorded] == expected


async def test_answers_the_stored_body_of_the_current_version_without_computing() -> (
    None
):
    redis = FakeRedis({VERSION_KEY: b"3", entry(3): STORED_BODY})
    compute = Computation()

    assert (await body_of(redis, compute), compute.calls) == (STORED_BODY, 0)


async def test_recomputes_once_the_worker_bumps_the_version() -> None:
    redis = FakeRedis({VERSION_KEY: b"4", entry(3): STORED_BODY})
    compute = Computation()

    assert (await body_of(redis, compute), compute.calls) == (COMPUTED_BODY, 1)
    assert redis.bodies[entry(4)] == COMPUTED_BODY


async def test_stores_under_version_0_while_no_version_was_bumped() -> None:
    redis = FakeRedis()

    assert await body_of(redis, Computation()) == COMPUTED_BODY
    assert (redis.bodies, redis.ttls) == (
        {entry(0): COMPUTED_BODY},
        {entry(0): 3600},
    )


async def test_recomputes_a_stored_body_of_an_older_shape() -> None:
    redis = FakeRedis({VERSION_KEY: b"3", entry(3): b'{"stageNorms":{"final":17}}'})
    compute = Computation()

    assert (await body_of(redis, compute), compute.calls) == (COMPUTED_BODY, 1)
    assert redis.bodies[entry(3)] == COMPUTED_BODY


@pytest.mark.enable_socket
@pytest.mark.parametrize("outage", list(OUTAGES.values()), ids=list(OUTAGES))
async def test_computes_without_storing_when_the_version_read_fails(
    outage: Outage,
) -> None:
    compute = Computation()
    with outage() as port:
        redis = create_redis(settings_for(redis_port=port))
        started = time.monotonic()
        body, deltas = await counted(redis, compute)
        elapsed = time.monotonic() - started
        await redis.aclose()

    assert (body, deltas, compute.calls) == (
        COMPUTED_BODY,
        {"hit": 0.0, "miss": 0.0, "bypass": 1.0, "computes": 1.0},
        1,
    )
    assert elapsed < DEPENDENCY_LIMITS.ping + 1
