from fastapi import APIRouter, Request

from app.core.auth import CurrentUserId
from app.metrics.resume_ab import ResumeAb
from app.services.resume_ab import user_resume_ab

router = APIRouter(prefix="/analytics")


@router.get("/resume-ab", response_model=ResumeAb)
async def get_resume_ab(request: Request, *, user_id: CurrentUserId) -> ResumeAb:
    return await user_resume_ab(request.app.state.engine, user_id=user_id)
