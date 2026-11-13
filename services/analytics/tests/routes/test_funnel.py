import time

import pytest

from app.core.config import DEPENDENCY_LIMITS
from tests.factories import (
    SEARCH_ID,
    SIGNER,
    auth_app,
    bearer,
    closed_port,
    problem_body,
    serving,
    settings_for,
    silent_listener,
)

FUNNEL_PATH = "/analytics/funnel"
NOT_READY_BODY = problem_body(
    503, type="not_ready", title="Service not ready", detail="Not reachable: postgres"
)


@pytest.mark.parametrize(
    "query", [{}, {"searchId": "42"}], ids=["missing", "not a uuid"]
)
def test_refuses_a_search_id_that_is_not_a_uuid_at_query_search_id(
    query: dict[str, str],
) -> None:
    with serving(auth_app()) as client:
        response = client.get(
            FUNNEL_PATH, params=query, headers=bearer(SIGNER.user_token())
        )

    body = response.json()
    assert (response.status_code, body["type"]) == (422, "validation_error")
    assert [error["path"] for error in body["errors"]] == ["query.searchId"]


def funnel_with_postgres_on(port: int) -> tuple[int, object, float]:
    app = auth_app(settings=settings_for(postgres_port=port))
    with serving(app) as client:
        started = time.monotonic()
        response = client.get(
            FUNNEL_PATH,
            params={"searchId": str(SEARCH_ID)},
            headers=bearer(SIGNER.user_token()),
        )
        elapsed = time.monotonic() - started
    return response.status_code, response.json(), elapsed


@pytest.mark.enable_socket
def test_answers_not_ready_when_postgres_refuses_the_connection() -> None:
    status, body, _ = funnel_with_postgres_on(closed_port())

    assert (status, body) == (503, NOT_READY_BODY)


@pytest.mark.enable_socket
def test_gives_up_on_a_silent_postgres_within_the_connect_limit() -> None:
    with silent_listener() as port:
        status, body, elapsed = funnel_with_postgres_on(port)

    assert (status, body) == (503, NOT_READY_BODY)
    assert DEPENDENCY_LIMITS.connect - 0.1 <= elapsed < DEPENDENCY_LIMITS.connect + 1
