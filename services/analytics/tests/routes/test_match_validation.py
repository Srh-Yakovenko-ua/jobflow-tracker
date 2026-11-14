from tests.factories import UNAUTHORIZED_BODY, auth_app, serving

MATCH_VALIDATION_PATH = "/analytics/match-validation"


def test_refuses_the_match_score_validation_without_a_token() -> None:
    with serving(auth_app()) as client:
        response = client.get(
            MATCH_VALIDATION_PATH,
            headers={"x-request-id": UNAUTHORIZED_BODY["requestId"]},
        )

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)
