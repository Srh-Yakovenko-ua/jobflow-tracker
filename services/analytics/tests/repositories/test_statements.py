from collections.abc import Callable
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import Select
from sqlalchemy.dialects import postgresql

from app.repositories.applications import (
    applications_statement,
    latest_change_statement,
)
from app.repositories.events import events_statement
from app.repositories.searches import active_search_statement, search_statement
from tests.factories import SEARCH_ID, USER_ID

type Statement = Callable[..., Select[Any]]

OWNERSHIP_PREDICATES = (
    "applications.user_id =",
    "applications.search_id =",
    "applications.deleted_at IS NULL",
    "applications.is_draft IS false",
)

SEARCH_PREDICATES = ("searches.id =", "searches.user_id =")
ACTIVE_SEARCH_PREDICATES = ("searches.user_id =", "CAST(searches.status AS TEXT) =")

STATEMENTS = {
    "events": (events_statement, OWNERSHIP_PREDICATES),
    "applications": (applications_statement, OWNERSHIP_PREDICATES),
    "search": (search_statement, SEARCH_PREDICATES),
}


@pytest.mark.parametrize(
    ("statement", "predicates"), list(STATEMENTS.values()), ids=list(STATEMENTS)
)
def test_reads_only_what_the_user_owns_in_the_search(
    statement: Statement, predicates: tuple[str, ...]
) -> None:
    compiled = statement(user_id=USER_ID, search_id=SEARCH_ID).compile(
        dialect=postgresql.dialect()
    )

    bound: set[UUID] = set(compiled.params.values())
    assert {USER_ID, SEARCH_ID} <= bound
    assert [p for p in predicates if p not in str(compiled)] == []


def user_wide(statement: Select[Any]) -> tuple[set[object], str]:
    compiled = statement.compile(dialect=postgresql.dialect())
    return set(compiled.params.values()), str(compiled)


def test_reads_the_active_search_of_the_user_without_a_search_id() -> None:
    bound, sql = user_wide(events_statement(user_id=USER_ID, search_id=None))

    assert bound == {USER_ID, "active"}
    assert "applications.search_id IN (SELECT searches.id" in sql
    assert [p for p in OWNERSHIP_PREDICATES if p not in sql] == [
        "applications.search_id ="
    ]
    assert [p for p in ACTIVE_SEARCH_PREDICATES if p not in sql] == []


def test_the_active_search_reads_only_the_users_searches() -> None:
    bound, sql = user_wide(active_search_statement(user_id=USER_ID))

    assert bound == {USER_ID, "active"}
    assert [p for p in ACTIVE_SEARCH_PREDICATES if p not in sql] == []


def test_the_latest_change_reads_only_the_users_applications() -> None:
    bound, sql = user_wide(latest_change_statement(user_id=USER_ID))

    assert bound == {USER_ID}
    assert "max(applications.updated_at)" in sql
    assert "applications.user_id =" in sql
