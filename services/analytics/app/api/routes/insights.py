from datetime import UTC, datetime

from fastapi import APIRouter, Request

from app.api.routes.queries import SearchIdQuery
from app.core.auth import CurrentUserId
from app.metrics.insights.engine import Insights
from app.services.insights import search_insights

router = APIRouter(prefix="/analytics")


@router.get("/insights", response_model=Insights)
async def get_insights(
    request: Request, *, user_id: CurrentUserId, search_id: SearchIdQuery = None
) -> Insights:
    return await search_insights(
        request.app.state.engine,
        user_id=user_id,
        search_id=search_id,
        now=datetime.now(UTC),
    )
