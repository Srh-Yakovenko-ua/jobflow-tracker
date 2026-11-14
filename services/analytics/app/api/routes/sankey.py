from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response
from pydantic import TypeAdapter

from app.api.revalidation import cached_response
from app.core.auth import CurrentUserId
from app.metrics.sankey import Sankey, SankeySplit
from app.services.sankey import search_sankey

router = APIRouter(prefix="/analytics")

SANKEY = TypeAdapter(Sankey)


@router.get("/sankey", response_model=Sankey)
async def get_sankey(
    request: Request,
    *,
    user_id: CurrentUserId,
    search_id: Annotated[UUID, Query(alias="searchId")],
    split: Annotated[SankeySplit | None, Query()] = None,
) -> Response:
    return await cached_response(
        request,
        user_id=user_id,
        adapter=SANKEY,
        compute=lambda: search_sankey(
            request.app.state.engine,
            user_id=user_id,
            search_id=search_id,
            split=split,
        ),
    )
