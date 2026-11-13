from collections.abc import Callable
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import Select
from sqlalchemy.dialects import postgresql

from app.repositories.applications import applications_statement
from app.repositories.events import events_statement
from tests.factories import SEARCH_ID, USER_ID

type Statement = Callable[..., Select[Any]]

OWNERSHIP_PREDICATES = (
    "applications.user_id =",
    "applications.search_id =",
    "applications.deleted_at IS NULL",
    "applications.is_draft IS false",
)


@pytest.mark.parametrize("statement", [events_statement, applications_statement])
def test_reads_only_the_users_confirmed_applications_in_the_search(
    statement: Statement,
) -> None:
    compiled = statement(user_id=USER_ID, search_id=SEARCH_ID).compile(
        dialect=postgresql.dialect()
    )

    bound: set[UUID] = set(compiled.params.values())
    assert {USER_ID, SEARCH_ID} <= bound
    assert [p for p in OWNERSHIP_PREDICATES if p not in str(compiled)] == []
