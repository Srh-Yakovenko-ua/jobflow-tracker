from fastapi import APIRouter, Request, Response
from pydantic import TypeAdapter

from app.api.revalidation import cached_response
from app.core.auth import CurrentUserId
from app.metrics.match_validation import MatchValidation
from app.services.match_validation import user_match_validation

router = APIRouter(prefix="/analytics")

MATCH_VALIDATION = TypeAdapter(MatchValidation)


@router.get("/match-validation", response_model=MatchValidation)
async def get_match_validation(request: Request, *, user_id: CurrentUserId) -> Response:
    return await cached_response(
        request,
        user_id=user_id,
        adapter=MATCH_VALIDATION,
        compute=lambda: user_match_validation(
            request.app.state.engine, user_id=user_id
        ),
    )
