import time

import pytest

from app.core.config import DEPENDENCY_LIMITS
from tests.factories import (
    REFUSED,
    SEARCH_ID,
    SIGNER,
    auth_app,
    bearer,
    closed_port,
    problem_body,
    refusal,
    serving,
    settings_for,
    silent_listener,
)
from tests.routes.test_reasons import REASONS_PATH, SUMMARY_PATH
from tests.routes.test_sources import SOURCES_PATH

FUNNEL_PATH = "/analytics/funnel"
SCREENING = {"stage": "screening"}

type PathCase = tuple[str, dict[str, str]]

SEARCH_PATHS: list[PathCase] = [
    (FUNNEL_PATH, {}),
    ("/analytics/sankey", {}),
    (REASONS_PATH, {}),
    (SUMMARY_PATH, SCREENING),
    (SOURCES_PATH, {}),
]
SEARCH_PATH_IDS = [path for path, _ in SEARCH_PATHS]
OUTAGE_QUERIES: dict[str, PathCase] = {
    **{
        path: (path, {"searchId": str(SEARCH_ID)} | params)
        for path, params in SEARCH_PATHS
    },
    "reasons of the active search": (REASONS_PATH, {}),
    "summary of the active search": (SUMMARY_PATH, SCREENING),
    "sources of the active search": (SOURCES_PATH, {}),
}
NOT_READY_BODY = problem_body(
    503, type="not_ready", title="Service not ready", detail="Not reachable: postgres"
)


@pytest.mark.parametrize(
    "query", [{}, {"searchId": "42"}], ids=["missing", "not a uuid"]
)
def test_refuses_a_search_id_that_is_not_a_uuid_at_query_search_id(
    query: dict[str, str],
) -> None:
    outcome, fields = refusal(FUNNEL_PATH, query)

    assert outcome == REFUSED
    assert fields == ["query.searchId"]


def search_with_postgres_on(port: int, *, case: PathCase) -> tuple[int, object, float]:
    path, query = case
    app = auth_app(settings=settings_for(postgres_port=port))
    with serving(app) as client:
        started = time.monotonic()
        response = client.get(path, params=query, headers=bearer(SIGNER.user_token()))
        elapsed = time.monotonic() - started
    return response.status_code, response.json(), elapsed


OUTAGE = pytest.mark.parametrize(
    "case", list(OUTAGE_QUERIES.values()), ids=list(OUTAGE_QUERIES)
)


@pytest.mark.enable_socket
@OUTAGE
def test_answers_not_ready_when_postgres_refuses_the_connection(case: PathCase) -> None:
    status, body, _ = search_with_postgres_on(closed_port(), case=case)

    assert (status, body) == (503, NOT_READY_BODY)


@pytest.mark.enable_socket
@OUTAGE
def test_gives_up_on_a_silent_postgres_within_the_connect_limit(case: PathCase) -> None:
    with silent_listener() as port:
        status, body, elapsed = search_with_postgres_on(port, case=case)

    assert (status, body) == (503, NOT_READY_BODY)
    assert DEPENDENCY_LIMITS.connect - 0.1 <= elapsed < DEPENDENCY_LIMITS.connect + 1
