from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request

from app.core.auth import CurrentUserId
from app.metrics.funnel import Funnel
from app.services.funnel import search_funnel

router = APIRouter(prefix="/analytics")


@router.get("/funnel", response_model=Funnel)
async def get_funnel(
    request: Request,
    *,
    user_id: CurrentUserId,
    search_id: Annotated[UUID, Query(alias="searchId")],
) -> Funnel:
    return await search_funnel(
        request.app.state.engine,
        user_id=user_id,
        search_id=search_id,
        now=datetime.now(UTC),
    )
