import pytest

from tests.factories import (
    REFUSED,
    SEARCH_ID,
    UNAUTHORIZED_BODY,
    auth_app,
    refusal,
    serving,
)

REASONS_PATH = "/analytics/reasons"
SUMMARY_PATH = "/analytics/reasons/summary"
REASONS_PATHS = [REASONS_PATH, SUMMARY_PATH]

REFUSED_QUERIES = {
    "unknown stage": (REASONS_PATH, {"stage": "offer_signed"}, "query.stage"),
    "unknown summary stage": (SUMMARY_PATH, {"stage": "hired"}, "query.stage"),
    "missing summary stage": (SUMMARY_PATH, {}, "query.stage"),
    "search id not a uuid": (REASONS_PATH, {"searchId": "42"}, "query.searchId"),
    "summary search id not a uuid": (
        SUMMARY_PATH,
        {"stage": "screening", "searchId": "42"},
        "query.searchId",
    ),
}


@pytest.mark.parametrize("path", REASONS_PATHS)
def test_refuses_reasons_without_a_token(path: str) -> None:
    with serving(auth_app()) as client:
        response = client.get(
            path,
            params={"stage": "screening", "searchId": str(SEARCH_ID)},
            headers={"x-request-id": UNAUTHORIZED_BODY["requestId"]},
        )

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)


@pytest.mark.parametrize(
    ("path", "query", "field"),
    list(REFUSED_QUERIES.values()),
    ids=list(REFUSED_QUERIES),
)
def test_refuses_a_query_outside_the_stages_or_a_search_id_not_a_uuid(
    path: str, *, query: dict[str, str], field: str
) -> None:
    outcome, fields = refusal(path, query)

    assert outcome == REFUSED
    assert fields == [field]
