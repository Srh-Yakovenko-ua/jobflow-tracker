from typing import Any

import httpx2
import pandas as pd
import pytest

from app.services import search_events
from tests.factories import (
    EXPIRED_BODY,
    REQUEST_ID,
    SEARCH_ID,
    SIGNER,
    UNAUTHORIZED_BODY,
    auth_app,
    bearer,
    closed_port,
    problem_body,
    refusal_messages,
    serving,
    timed_frame,
    uvicorn_serving,
)
from tests.metrics.test_kpis import KYIV_SEARCH, SENT_AROUND_AUGUST
from tests.routes.test_funnel import (
    FUNNEL_PATH,
    NOT_READY_BODY,
    SEARCH_PATH_IDS,
    SEARCH_PATHS,
    search_with_postgres_on,
)

pytestmark = pytest.mark.enable_socket

FORBIDDEN_BODY = problem_body(403, type="forbidden", title="Forbidden")
NOT_FOUND_BODY = problem_body(404, type="not_found", title="Not found")

REFUSALS = {
    "no token": ({"x-request-id": REQUEST_ID}, 401, UNAUTHORIZED_BODY),
    "expired token": (bearer(SIGNER.expired_token()), 401, EXPIRED_BODY),
    "no analytics scope": (
        bearer(SIGNER.user_token(scope="user")),
        403,
        FORBIDDEN_BODY,
    ),
}

AUGUST = {"month": "2026-08"}
AUGUST_QUERY = {"searchId": str(SEARCH_ID)} | AUGUST
MONTH_MESSAGE = "Value error, must be a calendar month written as YYYY-MM"
MALFORMED_MONTHS = ["2026-13", "2026-8", "abc", "2026-08-01"]


type Refusal = tuple[dict[str, str], int, dict[str, Any]]


@pytest.mark.parametrize(
    ("path", "query"),
    [*SEARCH_PATHS, (FUNNEL_PATH, AUGUST)],
    ids=[*SEARCH_PATH_IDS, "funnel of a month"],
)
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


def stored_search(monkeypatch: pytest.MonkeyPatch, search: pd.DataFrame) -> None:
    async def load_search(*_: object, **__: object) -> pd.DataFrame:
        return search

    async def load_events(*_: object, **__: object) -> pd.DataFrame:
        return timed_frame(SENT_AROUND_AUGUST)

    monkeypatch.setattr(search_events, "load_search", load_search)
    monkeypatch.setattr(search_events, "load_events", load_events)


def funnel_of_august() -> tuple[int, Any]:
    with serving(auth_app()) as client:
        response = client.get(
            FUNNEL_PATH, params=AUGUST_QUERY, headers=bearer(SIGNER.user_token())
        )
    return response.status_code, response.json()


def test_counts_sent_in_august_as_this_month_and_july_as_the_previous_month(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stored_search(monkeypatch, pd.DataFrame([KYIV_SEARCH.model_dump()]))

    status, body = funnel_of_august()

    assert (status, body["kpis"]["sent"]) == (
        200,
        {"total": 4, "thisMonth": 2, "previousMonth": 1},
    )


def test_answers_not_found_for_a_month_of_a_search_the_user_does_not_own(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stored_search(monkeypatch, pd.DataFrame())

    assert funnel_of_august() == (404, NOT_FOUND_BODY)


def test_answers_not_ready_for_a_month_when_postgres_refuses_the_connection() -> None:
    status, body, _ = search_with_postgres_on(
        closed_port(), case=(FUNNEL_PATH, AUGUST_QUERY)
    )

    assert (status, body) == (503, NOT_READY_BODY)


def test_explains_every_malformed_month_with_the_same_readable_message() -> None:
    queries = [AUGUST_QUERY | {"month": month} for month in MALFORMED_MONTHS]

    assert refusal_messages(FUNNEL_PATH, queries) == [
        (422, "query.month", MONTH_MESSAGE)
    ] * len(MALFORMED_MONTHS)
