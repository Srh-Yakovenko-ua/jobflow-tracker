from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.factory import create_app
from tests.factories import (
    SIGNER,
    UNAUTHORIZED_BODY,
    bearer,
    serving,
    with_payload_of,
    with_probe,
)

pytestmark = pytest.mark.enable_socket


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with serving(with_probe(create_app(settings))) as client:
        yield client


def test_accepts_a_token_the_api_issued_with_the_key_from_its_jwks(
    client: TestClient, registered: Any
) -> None:
    response = client.get("/probe/me", headers=bearer(registered["accessToken"]))

    assert (response.status_code, response.json()) == (
        200,
        {"userId": registered["user"]["id"]},
    )


def test_refuses_an_api_token_whose_payload_was_swapped(
    client: TestClient, registered: Any
) -> None:
    tampered = with_payload_of(registered["accessToken"], SIGNER.user_token())

    response = client.get("/probe/me", headers=bearer(tampered))

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)
