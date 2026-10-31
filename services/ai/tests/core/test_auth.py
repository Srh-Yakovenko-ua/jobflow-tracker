import socket
import time
from collections.abc import Iterator

import pytest

from app.factory import create_app
from tests.factories import auth_headers, post_completion, service_token, settings_for

pytestmark = pytest.mark.anyio


def tampered(token: str) -> str:
    header, _, signature = token.split(".")
    _, payload, _ = service_token(sub="someone-else").split(".")
    return f"{header}.{payload}.{signature}"


def problem_body(status: int, *, type_: str, title: str) -> dict[str, object]:
    return {"type": type_, "title": title, "status": status, "requestId": "req-test"}


async def test_answers_401_in_the_error_shape_without_a_token() -> None:
    response = await post_completion(headers={"x-request-id": "req-test"})

    assert (response.status_code, response.headers["www-authenticate"]) == (
        401,
        "Bearer",
    )
    assert response.json() == problem_body(
        401, type_="unauthorized", title="Unauthorized"
    )


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(tampered(service_token()), id="tampered"),
        pytest.param(
            service_token(iat=int(time.time()) - 120, exp=int(time.time()) - 60),
            id="expired",
        ),
        pytest.param(service_token(aud="jobflow-analytics"), id="wrong audience"),
        pytest.param(service_token(iss="someone"), id="wrong issuer"),
        pytest.param(
            service_token(
                iss=None,
                aud=None,
                sub="0b6f1c1e-6a8e-4c62-9d0e-1f2a3b4c5d6e",
                scope="user analytics:read",
            ),
            id="user access token",
        ),
        pytest.param("not-a-jwt", id="garbage"),
    ],
)
async def test_refuses_a_token_that_is_not_a_valid_service_token(token: str) -> None:
    response = await post_completion(headers=auth_headers(token))

    assert (response.status_code, response.json()) == (
        401,
        problem_body(401, type_="unauthorized", title="Unauthorized"),
    )


async def test_answers_403_for_a_service_token_without_the_ai_scope() -> None:
    response = await post_completion(headers=auth_headers(service_token(scope="user")))

    assert (response.status_code, response.json()) == (
        403,
        problem_body(403, type_="forbidden", title="Forbidden"),
    )


@pytest.fixture
def closed_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port: int = probe.getsockname()[1]
    return port


@pytest.fixture
def silent_port() -> Iterator[int]:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        yield listener.getsockname()[1]


@pytest.mark.parametrize("port_fixture", ["closed_port", "silent_port"])
async def test_answers_503_within_the_jwks_timeout_when_the_api_keys_cannot_be_fetched(
    request: pytest.FixtureRequest, port_fixture: str
) -> None:
    port = request.getfixturevalue(port_fixture)
    settings = settings_for(
        api_jwks_url=f"http://127.0.0.1:{port}/.well-known/jwks.json",
        jwks_timeout_seconds=0.3,
    )
    started = time.monotonic()

    response = await post_completion(app=create_app(settings))

    assert time.monotonic() - started < 2
    assert (response.status_code, response.json()) == (
        503,
        problem_body(503, type_="not_ready", title="Service not ready")
        | {"detail": "The API signing keys could not be fetched"},
    )
