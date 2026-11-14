from fastapi import APIRouter, Request, Response
from pydantic import TypeAdapter

from app.api.revalidation import cached_response
from app.core.auth import CurrentUserId
from app.metrics.resume_ab import ResumeAb
from app.services.resume_ab import user_resume_ab

router = APIRouter(prefix="/analytics")

RESUME_AB = TypeAdapter(ResumeAb)


@router.get("/resume-ab", response_model=ResumeAb)
async def get_resume_ab(request: Request, *, user_id: CurrentUserId) -> Response:
    return await cached_response(
        request,
        user_id=user_id,
        adapter=RESUME_AB,
        compute=lambda: user_resume_ab(request.app.state.engine, user_id=user_id),
    )
