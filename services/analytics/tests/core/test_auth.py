import time
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager, contextmanager

import httpx2
import jwt
import pytest
from fastapi import FastAPI

from app.core.config import DEPENDENCY_LIMITS
from app.factory import create_app
from tests.factories import (
    EXPIRED_BODY,
    REQUEST_ID,
    ROTATED_SIGNER,
    SIGNER,
    UNAUTHORIZED_BODY,
    auth_app,
    bearer,
    closed_port,
    jwks_server,
    problem_body,
    serving,
    settings_for,
    silent_listener,
    with_payload_of,
    with_probe,
)

OTHER_USER_ID = "0196f0a1-7c2e-7b3d-8a41-5e6f7a8b9c2f"
HMAC_SECRET = "analytics-test-shared-secret-of-32-bytes"


def hs256_copy(token: str) -> str:
    claims = jwt.decode(token, options={"verify_signature": False})
    return jwt.encode(claims, HMAC_SECRET, "HS256", headers={"kid": SIGNER.kid})


REFUSED_TOKENS = {
    "tampered": with_payload_of(
        SIGNER.user_token(), SIGNER.user_token(sub=OTHER_USER_ID)
    ),
    "garbage": "not.a.jwt",
    "hs256": hs256_copy(SIGNER.user_token()),
    "service_token": SIGNER.user_token(
        iss="jobflow-api", aud="jobflow-ai", sub="worker", scope="ai:invoke"
    ),
    "non_uuid_sub": SIGNER.user_token(sub="worker"),
}


def get_me(app: FastAPI, headers: dict[str, str]) -> httpx2.Response:
    with serving(app) as client:
        return client.get("/probe/me", headers=headers)


def served_by(api_port: int) -> FastAPI:
    return with_probe(create_app(settings_for(api_port=api_port)))


@contextmanager
def refused_port() -> Iterator[int]:
    yield closed_port()


def test_accepts_a_token_signed_by_the_api_key_and_returns_its_user() -> None:
    response = get_me(auth_app(), bearer(SIGNER.user_token()))

    assert (response.status_code, response.json()) == (
        200,
        {"userId": "0196f0a1-7c2e-7b3d-8a41-5e6f7a8b9c0d"},
    )


def test_refuses_a_request_without_a_token_with_a_bearer_challenge() -> None:
    response = get_me(auth_app(), {"x-request-id": REQUEST_ID})

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("token", REFUSED_TOKENS.values(), ids=REFUSED_TOKENS.keys())
def test_refuses_a_token_the_api_did_not_issue_for_a_user(token: str) -> None:
    response = get_me(auth_app(), bearer(token))

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)
    assert response.headers["www-authenticate"] == "Bearer"


def test_answers_an_expired_token_with_token_expired_so_the_web_refreshes() -> None:
    response = get_me(auth_app(), bearer(SIGNER.expired_token()))

    assert (response.status_code, response.json()) == (401, EXPIRED_BODY)


def test_forbids_a_token_without_the_analytics_read_scope() -> None:
    response = get_me(auth_app(), bearer(SIGNER.user_token(scope="user")))

    assert (response.status_code, response.json()) == (
        403,
        problem_body(403, type="forbidden", title="Forbidden"),
    )


@pytest.mark.enable_socket
def test_refetches_the_key_set_for_an_unknown_kid_and_not_for_a_known_one() -> None:
    with jwks_server([SIGNER]) as server, serving(served_by(server.port)) as client:
        first = client.get("/probe/me", headers=bearer(SIGNER.user_token()))
        server.signers.append(ROTATED_SIGNER)
        rotated = client.get("/probe/me", headers=bearer(ROTATED_SIGNER.user_token()))
        known = client.get("/probe/me", headers=bearer(SIGNER.user_token()))

    statuses = [response.status_code for response in (first, rotated, known)]
    assert (statuses, server.hits) == ([200, 200, 200], 2)


@pytest.mark.enable_socket
@pytest.mark.parametrize(
    "unreachable", [refused_port, silent_listener], ids=["refused", "silent"]
)
def test_answers_not_ready_within_the_connect_limit_when_the_jwks_is_unreachable(
    unreachable: Callable[[], AbstractContextManager[int]],
) -> None:
    with unreachable() as port, serving(served_by(port)) as client:
        started = time.monotonic()
        response = client.get("/probe/me", headers=bearer(SIGNER.user_token()))
        elapsed = time.monotonic() - started

    assert (response.status_code, response.json()) == (
        503,
        problem_body(
            503,
            type="not_ready",
            title="Service not ready",
            detail="The API signing keys could not be fetched",
        ),
    )
    assert elapsed < DEPENDENCY_LIMITS.connect + 1
