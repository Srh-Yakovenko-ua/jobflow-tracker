from uuid import UUID

from fastapi.testclient import TestClient

REQUEST_ID = "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f"


def test_answers_ok_and_echoes_a_uuid_request_id(client: TestClient) -> None:
    response = client.get("/health", headers={"x-request-id": REQUEST_ID})

    assert (
        response.status_code,
        response.json(),
        response.headers["x-request-id"],
    ) == (
        200,
        {"status": "ok"},
        REQUEST_ID,
    )


def test_replaces_a_request_id_that_is_not_a_uuid(client: TestClient) -> None:
    response = client.get("/nowhere", headers={"x-request-id": "req; drop"})

    body = response.json()
    assert (response.status_code, body["type"], body["requestId"]) == (
        404,
        "not_found",
        response.headers["x-request-id"],
    )
    assert UUID(body["requestId"]).version == 4
