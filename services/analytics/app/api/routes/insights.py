from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response
from pydantic import TypeAdapter

from app.api.revalidation import cached_response
from app.api.routes.queries import SearchIdQuery
from app.core.auth import CurrentUserId
from app.metrics.insights.engine import Insights
from app.services.insights import search_insights

router = APIRouter(prefix="/analytics")

INSIGHTS = TypeAdapter(Insights)


@router.get("/insights", response_model=Insights)
async def get_insights(
    request: Request, *, user_id: CurrentUserId, search_id: SearchIdQuery = None
) -> Response:
    return await cached_response(
        request,
        user_id=user_id,
        adapter=INSIGHTS,
        compute=lambda: search_insights(
            request.app.state.engine,
            user_id=user_id,
            search_id=search_id,
            now=datetime.now(UTC),
        ),
    )
