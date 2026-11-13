from tests.factories import UNAUTHORIZED_BODY, auth_app, serving

RESUME_AB_PATH = "/analytics/resume-ab"


def test_refuses_the_resume_comparison_without_a_token() -> None:
    with serving(auth_app()) as client:
        response = client.get(
            RESUME_AB_PATH, headers={"x-request-id": UNAUTHORIZED_BODY["requestId"]}
        )

    assert (response.status_code, response.json()) == (401, UNAUTHORIZED_BODY)
