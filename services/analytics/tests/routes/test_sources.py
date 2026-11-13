from tests.factories import REFUSED, UNAUTHORIZED_BODY, auth_app, refusal, serving

SOURCES_PATH = "/analytics/sources"


def test_refuses_sources_without_a_token() -> None:
    with serving(auth_app()) as client:
        response = client.get(
            SOURCES_PATH, headers={"x-request-id": UNAUTHORIZED_BODY["requestId"]}
        )

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)


def test_refuses_a_search_id_that_is_not_a_uuid_at_query_search_id() -> None:
    assert refusal(SOURCES_PATH, {"searchId": "42"}) == (REFUSED, ["query.searchId"])
