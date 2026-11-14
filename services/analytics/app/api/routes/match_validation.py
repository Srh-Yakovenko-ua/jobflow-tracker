from fastapi import APIRouter, Request

from app.core.auth import CurrentUserId
from app.metrics.match_validation import MatchValidation
from app.services.match_validation import user_match_validation

router = APIRouter(prefix="/analytics")


@router.get("/match-validation", response_model=MatchValidation)
async def get_match_validation(
    request: Request, *, user_id: CurrentUserId
) -> MatchValidation:
    return await user_match_validation(request.app.state.engine, user_id=user_id)
