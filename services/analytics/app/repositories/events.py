from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import ColumnElement, Select, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.repositories.applications import confirmed_in_search, confirmed_of
from app.repositories.frames import read_frame
from app.repositories.tables import applications, stage_events


def events_where(conditions: list[ColumnElement[bool]]) -> Select[Any]:
    return (
        select(stage_events)
        .join(applications, applications.c.id == stage_events.c.application_id)
        .where(*conditions)
        .order_by(stage_events.c.occurred_at, stage_events.c.id)
    )


def events_statement(*, user_id: UUID, search_id: UUID | None) -> Select[Any]:
    return events_where(confirmed_in_search(user_id=user_id, search_id=search_id))


def user_events_statement(*, user_id: UUID) -> Select[Any]:
    return events_where(confirmed_of(user_id))


async def load_events(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None
) -> pd.DataFrame:
    return await read_frame(
        engine, events_statement(user_id=user_id, search_id=search_id)
    )


async def load_user_events(engine: AsyncEngine, *, user_id: UUID) -> pd.DataFrame:
    return await read_frame(engine, user_events_statement(user_id=user_id))
