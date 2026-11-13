from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import ColumnElement, Select, false, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.repositories.frames import read_frame
from app.repositories.tables import applications


def confirmed_in_search(*, user_id: UUID, search_id: UUID) -> list[ColumnElement[bool]]:
    return [
        applications.c.user_id == user_id,
        applications.c.search_id == search_id,
        applications.c.deleted_at.is_(None),
        applications.c.is_draft.is_(false()),
    ]


def applications_statement(*, user_id: UUID, search_id: UUID) -> Select[Any]:
    return (
        select(applications)
        .where(*confirmed_in_search(user_id=user_id, search_id=search_id))
        .order_by(applications.c.created_at, applications.c.id)
    )


async def load_applications(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID
) -> pd.DataFrame:
    return await read_frame(
        engine, applications_statement(user_id=user_id, search_id=search_id)
    )
