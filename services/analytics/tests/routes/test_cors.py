import httpx2

from tests.factories import (
    EXPIRED_BODY,
    SIGNER,
    WEB_ORIGIN,
    auth_app,
    bearer,
    serving,
)


def preflight_from(origin: str) -> httpx2.Response:
    with serving(auth_app()) as client:
        return client.options(
            "/probe/me",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization",
            },
        )


def test_allows_the_web_origin_to_send_the_authorization_header() -> None:
    response = preflight_from(WEB_ORIGIN)

    assert (
        response.status_code,
        response.headers["access-control-allow-origin"],
        response.headers["access-control-allow-headers"],
        "access-control-allow-credentials" in response.headers,
    ) == (
        200,
        "http://localhost:3000",
        "Accept, Accept-Language, Authorization, Content-Language, Content-Type",
        False,
    )


def test_gives_another_origin_no_allow_origin_header() -> None:
    response = preflight_from("https://elsewhere.example")

    assert "access-control-allow-origin" not in response.headers


def test_lets_the_web_read_an_expired_token_answer_and_its_request_id() -> None:
    headers = {**bearer(SIGNER.expired_token()), "Origin": WEB_ORIGIN}

    with serving(auth_app()) as client:
        response = client.get("/probe/me", headers=headers)

    assert (response.status_code, response.json()) == (401, EXPIRED_BODY)
    assert (
        response.headers["access-control-allow-origin"],
        response.headers["access-control-expose-headers"],
        "access-control-allow-credentials" in response.headers,
    ) == ("http://localhost:3000", "x-request-id, Retry-After", False)
