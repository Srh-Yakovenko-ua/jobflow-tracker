import pytest

from tests.factories import (
    REFUSED,
    UNAUTHORIZED_BODY,
    auth_app,
    refusal,
    refusal_messages,
    serving,
)

FORECAST_PATH = "/analytics/forecast"
IMPROVE_MESSAGE = "Value error, must be an active stage and a conversion in (0, 1]"
MALFORMED_IMPROVES = ["tech_interview", "tech_interview:abc", "offer:0.6", ":"]

REFUSED_QUERIES = {
    "search id not a uuid": ({"searchId": "42"}, "query.searchId"),
    "negative rate": ({"applicationsPerWeek": "-1"}, "query.applicationsPerWeek"),
    "infinite rate": ({"applicationsPerWeek": "inf"}, "query.applicationsPerWeek"),
    "offer is not active": ({"improve": "offer:0.6"}, "query.improve"),
    "conversion above one": ({"improve": "tech_interview:1.5"}, "query.improve"),
    "no conversion": ({"improve": "tech_interview"}, "query.improve"),
    "zero conversion": ({"improve": "tech_interview:0"}, "query.improve"),
}


def test_refuses_the_forecast_without_a_token() -> None:
    with serving(auth_app()) as client:
        response = client.get(
            FORECAST_PATH, headers={"x-request-id": UNAUTHORIZED_BODY["requestId"]}
        )

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)


@pytest.mark.parametrize(
    ("query", "field"), list(REFUSED_QUERIES.values()), ids=list(REFUSED_QUERIES)
)
def test_refuses_a_what_if_outside_the_active_stages_or_a_rate_that_is_not_finite(
    query: dict[str, str], field: str
) -> None:
    assert refusal(FORECAST_PATH, query) == (REFUSED, [field])


def test_explains_every_malformed_improve_with_the_same_readable_message() -> None:
    queries = [{"improve": improve} for improve in MALFORMED_IMPROVES]

    assert refusal_messages(FORECAST_PATH, queries) == [
        (422, "query.improve", IMPROVE_MESSAGE)
    ] * len(MALFORMED_IMPROVES)
