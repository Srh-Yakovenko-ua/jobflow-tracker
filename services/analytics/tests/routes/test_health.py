import time
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.config import DEPENDENCY_LIMITS
from app.factory import create_app
from app.services.readiness import ReadinessService
from tests.factories import (
    OPENAPI_PATHS,
    REQUEST_ID,
    closed_port,
    problem_body,
    serving,
    settings_for,
    silent_listener,
)


async def answer() -> None:
    return None


def test_answers_liveness_and_echoes_the_request_id(client: TestClient) -> None:
    response = client.get("/health", headers={"x-request-id": REQUEST_ID})

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-request-id"] == REQUEST_ID


def test_answers_an_unknown_path_with_a_problem_and_a_fresh_request_id(
    client: TestClient,
) -> None:
    response = client.get("/nowhere", headers={"x-request-id": "not-a-uuid"})

    body = response.json()
    assert (response.status_code, body) == (
        404,
        problem_body(
            404,
            type="not_found",
            title="Not found",
            request_id=response.headers["x-request-id"],
        ),
    )
    assert UUID(body["requestId"]).version == 4


def test_serves_swagger_ui_on_docs(client: TestClient) -> None:
    response = client.get("/docs")

    assert (response.status_code, "swagger-ui" in response.text) == (200, True)


def test_lists_the_health_and_metric_paths_in_the_openapi_schema(
    client: TestClient,
) -> None:
    paths = client.get("/openapi.json").json()["paths"]

    assert sorted(paths) == OPENAPI_PATHS


def test_reports_ready_when_postgres_and_redis_answer() -> None:
    app = create_app(settings_for())
    app.state.readiness = ReadinessService({"postgres": answer, "redis": answer})

    with serving(app) as client:
        response = client.get("/health/ready")

    assert (response.status_code, response.json()) == (
        200,
        {"status": "ok", "checks": {"postgres": "up", "redis": "up"}},
    )


@pytest.mark.enable_socket
def test_reports_not_ready_when_postgres_and_redis_refuse() -> None:
    port = closed_port()
    settings = settings_for(postgres_port=port, redis_port=port)

    with serving(create_app(settings)) as refused:
        response = refused.get("/health/ready", headers={"x-request-id": REQUEST_ID})

    assert (response.status_code, response.json()) == (
        503,
        problem_body(
            503,
            type="not_ready",
            title="Service not ready",
            detail="Not reachable: postgres, redis",
        ),
    )


@pytest.mark.enable_socket
@pytest.mark.parametrize("silent", ["postgres", "redis"])
def test_gives_up_on_a_dependency_that_never_answers_within_the_ping_limit(
    silent: str,
) -> None:
    with silent_listener() as port:
        ports = {"postgres_port": closed_port(), "redis_port": closed_port()}
        settings = settings_for(**{**ports, f"{silent}_port": port})
        with serving(create_app(settings)) as stalled:
            started = time.monotonic()
            response = stalled.get("/health/ready")
            elapsed = time.monotonic() - started

    assert (response.status_code, response.json()["detail"]) == (
        503,
        "Not reachable: postgres, redis",
    )
    assert DEPENDENCY_LIMITS.ping - 0.1 <= elapsed < DEPENDENCY_LIMITS.ping + 0.5
