from fastapi.testclient import TestClient

from app.factory import create_app
from tests.factories import serving, settings_for

DURATION = "http_request_duration_seconds_count"


def duration_lines(client: TestClient) -> list[str]:
    exposition = client.get("/metrics").text
    return [line for line in exposition.splitlines() if line.startswith(DURATION)]


def test_serves_metrics_without_a_token(client: TestClient) -> None:
    response = client.get("/metrics")

    assert (response.status_code, response.headers["content-type"]) == (
        200,
        "text/plain; version=1.0.0; charset=utf-8",
    )


def test_times_a_metric_request_by_its_route_and_skips_health(
    client: TestClient,
) -> None:
    client.get("/health")
    client.get("/analytics/funnel")

    lines = duration_lines(client)

    assert [line for line in lines if 'handler="/analytics/funnel"' in line] == [
        'http_request_duration_seconds_count{handler="/analytics/funnel",method="GET"} 1.0'
    ]
    assert [line for line in lines if "/health" in line or "/metrics" in line] == []


def test_a_second_app_in_one_process_exposes_its_own_metrics() -> None:
    create_app(settings_for())
    with serving(create_app(settings_for())) as second:
        response = second.get("/metrics")

    assert response.status_code == 200
    assert "# TYPE analytics_metric_compute_seconds histogram" in response.text
    assert "# TYPE analytics_cache_lookups_total counter" in response.text
