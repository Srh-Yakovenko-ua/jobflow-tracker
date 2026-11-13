import pytest

from tests.factories import REFUSED, UNAUTHORIZED_BODY, auth_app, refusal, serving

TIMINGS_PATH = "/analytics/timings"
NORMS_PATH = "/analytics/norms"


@pytest.mark.parametrize("path", [TIMINGS_PATH, NORMS_PATH])
def test_refuses_timings_and_norms_without_a_token(path: str) -> None:
    with serving(auth_app()) as client:
        response = client.get(
            path, headers={"x-request-id": UNAUTHORIZED_BODY["requestId"]}
        )

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)


def test_refuses_a_search_id_that_is_not_a_uuid_at_query_search_id() -> None:
    assert refusal(TIMINGS_PATH, {"searchId": "42"}) == (REFUSED, ["query.searchId"])
