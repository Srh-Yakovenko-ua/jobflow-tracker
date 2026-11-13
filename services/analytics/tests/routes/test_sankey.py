from tests.factories import SEARCH_ID, SIGNER, auth_app, bearer, serving


def test_refuses_a_split_by_source_at_query_split() -> None:
    query = {"searchId": str(SEARCH_ID), "split": "source"}
    with serving(auth_app()) as client:
        body = client.get(
            "/analytics/sankey", params=query, headers=bearer(SIGNER.user_token())
        ).json()

    assert (body["status"], body["type"]) == (422, "validation_error")
    assert [error["path"] for error in body["errors"]] == ["query.split"]
