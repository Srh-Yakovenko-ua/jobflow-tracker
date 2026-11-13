from fastapi import APIRouter, Request

from app.api.routes.queries import SearchIdQuery
from app.core.auth import CurrentUserId
from app.metrics.sources import Sources
from app.services.sources import search_sources

router = APIRouter(prefix="/analytics")


@router.get("/sources", response_model=Sources)
async def get_sources(
    request: Request, *, user_id: CurrentUserId, search_id: SearchIdQuery = None
) -> Sources:
    return await search_sources(
        request.app.state.engine, user_id=user_id, search_id=search_id
    )
