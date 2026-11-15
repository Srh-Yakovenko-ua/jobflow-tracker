from tests.factories import UNAUTHORIZED_BODY, auth_app, serving

SALARY_PATH = "/analytics/salary"


def test_refuses_the_salary_analytics_without_a_token() -> None:
    with serving(auth_app()) as client:
        response = client.get(
            SALARY_PATH, headers={"x-request-id": UNAUTHORIZED_BODY["requestId"]}
        )

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)
