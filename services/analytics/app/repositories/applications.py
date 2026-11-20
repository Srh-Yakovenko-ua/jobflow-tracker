from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import ColumnElement, Select, false, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.repositories.frames import read_frame
from app.repositories.searches import active_search_statement
from app.repositories.tables import applications


def confirmed_of(user_id: UUID) -> list[ColumnElement[bool]]:
    return [
        applications.c.user_id == user_id,
        applications.c.deleted_at.is_(None),
        applications.c.is_draft.is_(false()),
    ]


def confirmed_in_search(
    *, user_id: UUID, search_id: UUID | None
) -> list[ColumnElement[bool]]:
    in_search = (
        applications.c.search_id.in_(active_search_statement(user_id=user_id))
        if search_id is None
        else applications.c.search_id == search_id
    )
    return [*confirmed_of(user_id), in_search]


def application_sources_statement(
    *, user_id: UUID, search_id: UUID | None
) -> Select[Any]:
    return select(
        applications.c.id.label("application_id"),
        applications.c.source,
        applications.c.url,
    ).where(*confirmed_in_search(user_id=user_id, search_id=search_id))


def salaries_statement(*, user_id: UUID, search_id: UUID | None) -> Select[Any]:
    parsed = applications.c.ai_parsed
    return select(
        applications.c.id.label("application_id"),
        applications.c.salary_min,
        applications.c.salary_max,
        applications.c.currency,
        applications.c.stack,
        parsed[("seniority", "value")].astext.label("seniority"),
        parsed[("salaryTax", "value")].astext.label("salary_tax"),
    ).where(*confirmed_in_search(user_id=user_id, search_id=search_id))


def match_scores_statement(*, user_id: UUID) -> Select[Any]:
    return select(
        applications.c.id.label("application_id"), applications.c.match_score
    ).where(*confirmed_of(user_id))


async def load_application_sources(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None
) -> pd.DataFrame:
    return await read_frame(
        engine, application_sources_statement(user_id=user_id, search_id=search_id)
    )


async def load_salaries(
    engine: AsyncEngine, *, user_id: UUID, search_id: UUID | None
) -> pd.DataFrame:
    return await read_frame(
        engine, salaries_statement(user_id=user_id, search_id=search_id)
    )


async def load_match_scores(engine: AsyncEngine, *, user_id: UUID) -> pd.DataFrame:
    return await read_frame(engine, match_scores_statement(user_id=user_id))
