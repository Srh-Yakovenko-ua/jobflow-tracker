from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.repositories.applications import confirmed_in_search
from app.repositories.frames import read_frame
from app.repositories.tables import applications, stage_events


def events_statement(*, user_id: UUID, search_id: UUID) -> Select[Any]:
    return (
        select(stage_events)
        .join(applications, applications.c.id == stage_events.c.application_id)
        .where(*confirmed_in_search(user_id=user_id, search_id=search_id))
        .order_by(stage_events.c.occurred_at, stage_events.c.id)
    )


async def load_events(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID
) -> pd.DataFrame:
    return await read_frame(
        engine, events_statement(user_id=user_id, search_id=search_id)
    )
