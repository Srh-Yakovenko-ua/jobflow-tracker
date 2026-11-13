from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import Select, Text, cast, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.enums import ACTIVE_SEARCH
from app.repositories.frames import read_frame
from app.repositories.tables import searches, user_settings


def search_statement(*, user_id: UUID, search_id: UUID) -> Select[Any]:
    return (
        select(searches.c.started_at, searches.c.finished_at, user_settings.c.timezone)
        .join(user_settings, user_settings.c.user_id == searches.c.user_id)
        .where(searches.c.id == search_id, searches.c.user_id == user_id)
    )


def active_search_statement(*, user_id: UUID) -> Select[Any]:
    return select(searches.c.id).where(
        searches.c.user_id == user_id, cast(searches.c.status, Text) == ACTIVE_SEARCH
    )


async def load_search(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID
) -> pd.DataFrame:
    return await read_frame(
        engine, search_statement(user_id=user_id, search_id=search_id)
    )


async def load_active_search_id(engine: AsyncEngine, *, user_id: UUID) -> UUID | None:
    frame = await read_frame(engine, active_search_statement(user_id=user_id))
    return None if frame.empty else UUID(str(frame.iat[0, 0]))
