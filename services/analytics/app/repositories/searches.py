from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.repositories.frames import read_frame
from app.repositories.tables import searches, user_settings


def search_statement(*, user_id: UUID, search_id: UUID) -> Select[Any]:
    return (
        select(searches.c.started_at, searches.c.finished_at, user_settings.c.timezone)
        .join(user_settings, user_settings.c.user_id == searches.c.user_id)
        .where(searches.c.id == search_id, searches.c.user_id == user_id)
    )


async def load_search(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID
) -> pd.DataFrame:
    return await read_frame(
        engine, search_statement(user_id=user_id, search_id=search_id)
    )
