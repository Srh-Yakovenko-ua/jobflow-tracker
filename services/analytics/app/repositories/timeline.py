from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import Select, Text, cast, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.enums import FOLLOWUP_SENT
from app.repositories.applications import confirmed_in_search
from app.repositories.frames import read_frame
from app.repositories.tables import applications, timeline_events


def followups_statement(*, user_id: UUID, search_id: UUID | None) -> Select[Any]:
    return (
        select(timeline_events.c.application_id, timeline_events.c.occurred_at)
        .join(applications, applications.c.id == timeline_events.c.application_id)
        .where(
            *confirmed_in_search(user_id=user_id, search_id=search_id),
            cast(timeline_events.c.kind, Text) == FOLLOWUP_SENT,
        )
        .order_by(timeline_events.c.occurred_at, timeline_events.c.id)
    )


async def load_followups(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None
) -> pd.DataFrame:
    return await read_frame(
        engine, followups_statement(user_id=user_id, search_id=search_id)
    )
