from fastapi import APIRouter, Request, Response
from pydantic import TypeAdapter

from app.api.revalidation import cached_response
from app.api.routes.queries import SearchIdQuery
from app.core.auth import CurrentUserId
from app.metrics.norms import Norms
from app.metrics.timings import Timings
from app.services.norms import cached_norms
from app.services.timings import search_timings

router = APIRouter(prefix="/analytics")

TIMINGS = TypeAdapter(Timings)


@router.get("/timings", response_model=Timings)
async def get_timings(
    request: Request, *, user_id: CurrentUserId, search_id: SearchIdQuery = None
) -> Response:
    return await cached_response(
        request,
        user_id=user_id,
        adapter=TIMINGS,
        compute=lambda: search_timings(
            request.app.state.engine, user_id=user_id, search_id=search_id
        ),
    )


@router.get("/norms", response_model=Norms)
async def get_norms(request: Request, *, user_id: CurrentUserId) -> Norms:
    return await cached_norms(
        request.app.state.engine, request.app.state.redis, user_id=user_id
    )
