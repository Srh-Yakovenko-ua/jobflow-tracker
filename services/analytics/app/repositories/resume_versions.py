from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import Select, and_, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.repositories.applications import confirmed_of
from app.repositories.frames import read_frame
from app.repositories.tables import applications, resume_versions


def version_links_statement(*, user_id: UUID) -> Select[Any]:
    same_owner = and_(
        resume_versions.c.id == applications.c.resume_version_id,
        resume_versions.c.user_id == applications.c.user_id,
    )
    return (
        select(
            applications.c.id.label("application_id"),
            resume_versions.c.id.label("resume_version_id"),
            resume_versions.c.number,
            resume_versions.c.title,
        )
        .join(resume_versions, same_owner)
        .where(*confirmed_of(user_id), resume_versions.c.user_id == user_id)
    )


async def load_version_links(engine: AsyncEngine, *, user_id: UUID) -> pd.DataFrame:
    return await read_frame(engine, version_links_statement(user_id=user_id))
