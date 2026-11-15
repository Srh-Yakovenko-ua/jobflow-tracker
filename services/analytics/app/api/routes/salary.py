from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response
from pydantic import TypeAdapter

from app.api.revalidation import cached_response
from app.api.routes.queries import SearchIdQuery
from app.core.auth import CurrentUserId
from app.metrics.salary import Salary
from app.services.salary import search_salary

router = APIRouter(prefix="/analytics")

SALARY = TypeAdapter(Salary)


@router.get("/salary", response_model=Salary)
async def get_salary(
    request: Request, *, user_id: CurrentUserId, search_id: SearchIdQuery = None
) -> Response:
    return await cached_response(
        request,
        user_id=user_id,
        adapter=SALARY,
        compute=lambda: search_salary(
            request.app.state.engine,
            user_id=user_id,
            search_id=search_id,
            now=datetime.now(UTC),
        ),
    )
