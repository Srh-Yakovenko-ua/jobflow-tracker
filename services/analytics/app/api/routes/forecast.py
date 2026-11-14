from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response
from pydantic import TypeAdapter

from app.api.revalidation import cached_response
from app.api.routes.queries import (
    ApplicationsPerWeekQuery,
    ImproveQuery,
    SearchIdQuery,
    improvement_of,
)
from app.core.auth import CurrentUserId
from app.metrics.forecast import Forecast, ForecastResult, WhatIf
from app.metrics.rate import Insufficient
from app.services.forecast import search_forecast

router = APIRouter(prefix="/analytics")

FORECAST = TypeAdapter[Forecast | Insufficient](ForecastResult)


@router.get("/forecast", response_model=ForecastResult)
async def get_forecast(
    request: Request,
    *,
    user_id: CurrentUserId,
    search_id: SearchIdQuery = None,
    applications_per_week: ApplicationsPerWeekQuery = None,
    improve: ImproveQuery = None,
) -> Response:
    what_if = WhatIf(
        applications_per_week=applications_per_week,
        improve=None if improve is None else improvement_of(improve),
    )
    return await cached_response(
        request,
        user_id=user_id,
        adapter=FORECAST,
        compute=lambda: search_forecast(
            request.app.state.engine,
            user_id=user_id,
            search_id=search_id,
            what_if=what_if,
            now=datetime.now(UTC),
        ),
    )
