from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.errors import ServiceError
from app.services.readiness import ReadinessService

router = APIRouter()


class Health(BaseModel):
    status: Literal["ok"] = "ok"


class Checks(BaseModel):
    postgres: Literal["up"] = "up"
    redis: Literal["up"] = "up"


class Readiness(Health):
    checks: Checks = Checks()


@router.get("/health")
def health() -> Health:
    return Health()


@router.get("/health/ready")
async def ready(request: Request) -> Readiness:
    readiness: ReadinessService = request.app.state.readiness
    unreachable = await readiness.unreachable()
    if unreachable:
        raise ServiceError(503, detail=f"Not reachable: {', '.join(unreachable)}")
    return Readiness()
