from tests.factories import REFUSED, SEARCH_ID, refusal


def test_refuses_a_split_by_source_at_query_split() -> None:
    query = {"searchId": str(SEARCH_ID), "split": "source"}
    outcome, fields = refusal("/analytics/sankey", query)

    assert outcome == REFUSED
    assert fields == ["query.split"]
