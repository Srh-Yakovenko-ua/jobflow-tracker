from datetime import datetime
from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import ColumnElement, Select, false, func, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.repositories.frames import read_frame
from app.repositories.searches import active_search_statement
from app.repositories.tables import applications


def confirmed_in_search(
    *, user_id: UUID, search_id: UUID | None
) -> list[ColumnElement[bool]]:
    in_search = (
        applications.c.search_id.in_(active_search_statement(user_id=user_id))
        if search_id is None
        else applications.c.search_id == search_id
    )
    return [
        applications.c.user_id == user_id,
        in_search,
        applications.c.deleted_at.is_(None),
        applications.c.is_draft.is_(false()),
    ]


def applications_statement(*, user_id: UUID, search_id: UUID) -> Select[Any]:
    return (
        select(applications)
        .where(*confirmed_in_search(user_id=user_id, search_id=search_id))
        .order_by(applications.c.created_at, applications.c.id)
    )


def latest_change_statement(*, user_id: UUID) -> Select[Any]:
    return select(func.max(applications.c.updated_at)).where(
        applications.c.user_id == user_id
    )


async def load_applications(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID
) -> pd.DataFrame:
    return await read_frame(
        engine, applications_statement(user_id=user_id, search_id=search_id)
    )


async def load_latest_change(engine: AsyncEngine, *, user_id: UUID) -> datetime | None:
    frame = await read_frame(engine, latest_change_statement(user_id=user_id))
    moment: object = frame.iat[0, 0]
    return moment.to_pydatetime() if isinstance(moment, pd.Timestamp) else None
