from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import Select, Text, cast, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.enums import REJECTED_STAGE
from app.repositories.applications import confirmed_in_search
from app.repositories.frames import read_frame
from app.repositories.tables import applications, notes


def rejection_notes_statement(*, user_id: UUID, search_id: UUID | None) -> Select[Any]:
    return (
        select(notes.c.application_id, notes.c.body)
        .join(applications, applications.c.id == notes.c.application_id)
        .where(
            *confirmed_in_search(user_id=user_id, search_id=search_id),
            cast(applications.c.current_stage, Text) == REJECTED_STAGE,
        )
    )


async def load_rejection_notes(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None
) -> pd.DataFrame:
    return await read_frame(
        engine, rejection_notes_statement(user_id=user_id, search_id=search_id)
    )
