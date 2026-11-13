from collections.abc import Callable
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import Select
from sqlalchemy.dialects import postgresql

from app.repositories.applications import applications_statement
from app.repositories.events import events_statement
from app.repositories.searches import search_statement
from tests.factories import SEARCH_ID, USER_ID

type Statement = Callable[..., Select[Any]]

OWNERSHIP_PREDICATES = (
    "applications.user_id =",
    "applications.search_id =",
    "applications.deleted_at IS NULL",
    "applications.is_draft IS false",
)

SEARCH_PREDICATES = ("searches.id =", "searches.user_id =")

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
