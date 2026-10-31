import pytest

from tests.factories import build_app, client_of

pytestmark = pytest.mark.anyio


async def test_answers_ok_without_a_service_token() -> None:
    async with client_of(build_app()) as client:
        response = await client.get("/health", headers={"x-request-id": "req-health"})

    assert (
        response.status_code,
        response.json(),
        response.headers["x-request-id"],
    ) == (
        200,
        {"status": "ok"},
        "req-health",
    )


async def test_answers_404_in_the_error_shape_for_an_unknown_route() -> None:
    async with client_of(build_app()) as client:
        response = await client.get(
            "/v2/anything", headers={"x-request-id": "bad id with spaces"}
        )

    body = response.json()
    assert (
        response.status_code,
        body["type"],
        body["requestId"] == response.headers["x-request-id"],
    ) == (
        404,
        "not_found",
        True,
    )
    assert body["requestId"] != "bad id with spaces"
