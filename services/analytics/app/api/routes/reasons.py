from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response
from pydantic import AfterValidator, TypeAdapter

from app.api.revalidation import cached_response
from app.api.routes.queries import SearchIdQuery
from app.core.auth import CurrentUserId
from app.core.enums import load_domain_enums
from app.metrics.reasons import Reasons
from app.metrics.reasons_summary import ReasonsSummary
from app.services.reasons import search_reasons
from app.services.reasons_cache import cached_reasons_summary

router = APIRouter(prefix="/analytics")

REASONS = TypeAdapter(Reasons)


def known_stage(stage: str) -> str:
    if stage not in load_domain_enums().stages:
        raise ValueError("must be one of the stages")
    return stage


KnownStage = Annotated[str, AfterValidator(known_stage)]


@router.get("/reasons", response_model=Reasons)
async def get_reasons(
    request: Request,
    *,
    user_id: CurrentUserId,
    search_id: SearchIdQuery = None,
    stage: Annotated[KnownStage | None, Query()] = None,
) -> Response:
    return await cached_response(
        request,
        user_id=user_id,
        adapter=REASONS,
        compute=lambda: search_reasons(
            request.app.state.engine,
            user_id=user_id,
            search_id=search_id,
            stage=stage,
            now=datetime.now(UTC),
        ),
    )


@router.get("/reasons/summary", response_model=ReasonsSummary)
async def get_reasons_summary(
    request: Request,
    *,
    user_id: CurrentUserId,
    stage: Annotated[KnownStage, Query()],
    search_id: SearchIdQuery = None,
) -> ReasonsSummary:
    return await cached_reasons_summary(
        request.app.state.engine,
        request.app.state.redis,
        user_id=user_id,
        search_id=search_id,
        stage=stage,
    )
