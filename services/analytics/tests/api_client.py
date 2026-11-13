import statistics
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any
from uuid import uuid4

import httpx2
from fastapi import FastAPI
from redis import Redis

from app.core.config import Settings
from tests.factories import bearer, uvicorn_serving

API_TIMEOUT_SECONDS = 10
WARM_CALLS = 5

type Query = tuple[str, dict[str, str]]


def api_url(settings: Settings, path: str) -> str:
    return settings.api_url.rstrip("/") + "/api/v1" + path


def register(settings: Settings) -> Any:
    response = httpx2.post(
        api_url(settings, "/auth/register"),
        json={
            "email": f"analytics-{uuid4()}@example.com",
            "password": "analytics-password",
        },
        timeout=API_TIMEOUT_SECONDS,
    )
    assert response.status_code == 201
    return response.json()


def api_call(settings: Settings, *, token: str, request: tuple[str, str, Any]) -> Any:
    method, path, body = request
    response = httpx2.request(
        method,
        api_url(settings, path),
        json=body,
        headers=bearer(token),
        timeout=API_TIMEOUT_SECONDS,
    )
    assert response.is_success, response.text
    return response.json()


def rejected_at_screening(settings: Settings, *, token: str, reason: str) -> str:
    created = api_call(
        settings,
        token=token,
        request=("POST", "/applications", {"company": "Acme", "position": "QA"}),
    )
    path = f"/applications/{created['id']}/events"
    for move in (
        {"fromStage": "applied", "toStage": "screening"},
        {"fromStage": "screening", "toStage": "rejected", "reasonCode": reason},
    ):
        api_call(settings, token=token, request=("POST", path, move))
    return str(created["id"])


@contextmanager
def analytics_client(app: FastAPI, *, token: str) -> Iterator[httpx2.Client]:
    with (
        uvicorn_serving(app) as base_url,
        httpx2.Client(
            base_url=base_url, headers=bearer(token), timeout=API_TIMEOUT_SECONDS
        ) as client,
    ):
        yield client


def analytics_body(app: FastAPI, *, token: str, query: Query) -> Any:
    path, params = query
    with analytics_client(app, token=token) as client:
        response = client.get(path, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def warm_calls(app: FastAPI, *, token: str, query: Query) -> tuple[list[int], float]:
    path, params = query
    statuses, timings = [], []
    with analytics_client(app, token=token) as client:
        client.get(path, params=params)
        for _ in range(WARM_CALLS):
            started = time.perf_counter()
            statuses.append(client.get(path, params=params).status_code)
            timings.append(time.perf_counter() - started)
    return statuses, statistics.median(timings)


def timed_answer(app: FastAPI, *, token: str, query: Query) -> tuple[int, Any, float]:
    path, params = query
    with analytics_client(app, token=token) as client:
        started = time.monotonic()
        response = client.get(path, params=params)
        elapsed = time.monotonic() - started
    return response.status_code, response.json(), elapsed


def with_redis_on(settings: Settings, port: int) -> Settings:
    return settings.model_copy(update={"redis_url": f"redis://127.0.0.1:{port}"})


def fresh_keys(
    cache: Redis, *, pattern: str, answer: Callable[[], object]
) -> list[str]:
    for stale in cache.scan_iter(match=pattern):
        cache.delete(stale)
    answer()
    return list(cache.scan_iter(match=pattern))
