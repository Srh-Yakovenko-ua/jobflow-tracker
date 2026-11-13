from uuid import uuid4

import pytest
from sqlalchemy import Table, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.repositories.applications import load_applications
from app.repositories.events import load_events
from app.repositories.searches import load_search
from app.repositories.tables import metadata

pytestmark = [pytest.mark.anyio, pytest.mark.enable_socket]

INSUFFICIENT_PRIVILEGE = "42501"

WRITES = {
    "insert": "INSERT INTO searches (user_id, title) VALUES (:id, :value)",
    "update": "UPDATE applications SET company = :value WHERE id = :id",
    "delete": "DELETE FROM stage_events WHERE id = :id AND reason_code = :value",
}

EVENT_COLUMNS = [
    "id",
    "application_id",
    "compensates_event_id",
    "from_stage",
    "to_stage",
    "reason_code",
    "occurred_at",
]

APPLICATION_COLUMNS = [
    "id",
    "user_id",
    "search_id",
    "resume_version_id",
    "source",
    "current_stage",
    "work_mode",
    "currency",
    "salary_min",
    "salary_max",
    "match_score",
    "is_draft",
    "applied_at",
    "last_event_at",
    "deleted_at",
    "created_at",
]


@pytest.mark.parametrize("statement", WRITES.values(), ids=WRITES.keys())
async def test_the_database_refuses_a_write_from_analytics(
    engine: AsyncEngine, statement: str
) -> None:
    async with engine.connect() as connection:
        with pytest.raises(DBAPIError) as refused:
            await connection.execute(text(statement), {"id": uuid4(), "value": "x"})

    assert getattr(refused.value.orig, "pgcode", None) == INSUFFICIENT_PRIVILEGE


async def test_loads_no_events_for_a_user_without_applications(
    engine: AsyncEngine,
) -> None:
    events = await load_events(engine, user_id=uuid4(), search_id=uuid4())

    assert (len(events), list(events.columns)) == (0, EVENT_COLUMNS)


async def test_loads_no_applications_for_a_user_without_applications(
    engine: AsyncEngine,
) -> None:
    loaded = await load_applications(engine, user_id=uuid4(), search_id=uuid4())

    assert (len(loaded), list(loaded.columns)) == (0, APPLICATION_COLUMNS)


async def test_loads_no_search_for_an_unknown_search_id(engine: AsyncEngine) -> None:
    search = await load_search(engine, user_id=uuid4(), search_id=uuid4())

    assert (len(search), list(search.columns)) == (
        0,
        ["started_at", "finished_at", "timezone"],
    )


@pytest.mark.parametrize(
    "table", metadata.sorted_tables, ids=lambda table: str(table.name)
)
async def test_every_declared_column_is_granted_to_analytics(
    engine: AsyncEngine, table: Table
) -> None:
    async with engine.connect() as connection:
        result = await connection.execute(select(table).limit(0))

    assert list(result.keys()) == [column.name for column in table.columns]
