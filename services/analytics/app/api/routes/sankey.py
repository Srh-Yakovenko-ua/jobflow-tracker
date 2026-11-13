from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request

from app.core.auth import CurrentUserId
from app.metrics.sankey import Sankey, SankeySplit
from app.services.sankey import search_sankey

router = APIRouter(prefix="/analytics")


@router.get("/sankey", response_model=Sankey)
async def get_sankey(
    request: Request,
    *,
    user_id: CurrentUserId,
    search_id: Annotated[UUID, Query(alias="searchId")],
    split: Annotated[SankeySplit | None, Query()] = None,
) -> Sankey:
    return await search_sankey(
        request.app.state.engine,
        user_id=user_id,
        search_id=search_id,
        split=split,
    )
