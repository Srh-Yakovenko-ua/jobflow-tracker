from typing import Any

import httpx2
import pytest

from tests.factories import (
    EXPIRED_BODY,
    REQUEST_ID,
    SEARCH_ID,
    SIGNER,
    UNAUTHORIZED_BODY,
    auth_app,
    bearer,
    problem_body,
    uvicorn_serving,
)
from tests.routes.test_funnel import SEARCH_PATH_IDS, SEARCH_PATHS

pytestmark = pytest.mark.enable_socket

FORBIDDEN_BODY = problem_body(403, type="forbidden", title="Forbidden")

REFUSALS = {
    "no token": ({"x-request-id": REQUEST_ID}, 401, UNAUTHORIZED_BODY),
    "expired token": (bearer(SIGNER.expired_token()), 401, EXPIRED_BODY),
    "no analytics scope": (
        bearer(SIGNER.user_token(scope="user")),
        403,
        FORBIDDEN_BODY,
    ),
}


type Refusal = tuple[dict[str, str], int, dict[str, Any]]


@pytest.mark.parametrize(("path", "query"), SEARCH_PATHS, ids=SEARCH_PATH_IDS)
@pytest.mark.parametrize("refusal", list(REFUSALS.values()), ids=list(REFUSALS))
def test_refuses_a_search_metric_over_http_without_a_valid_analytics_token(
    refusal: Refusal, *, path: str, query: dict[str, str]
) -> None:
    headers, status, body = refusal
    with uvicorn_serving(auth_app()) as base_url:
        response = httpx2.get(
            f"{base_url}{path}",
            params={"searchId": str(SEARCH_ID)} | query,
            headers=headers,
        )

    assert (response.status_code, response.json()) == (status, body)
