from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from loguru import logger

from app.api.deps import get_runtime
from app.contracts.embed_request import EmbedRequest
from app.core.auth import require_service_token
from app.core.request_id import request_id_of
from app.core.structured import Runtime, embed_texts

router = APIRouter(dependencies=[Depends(require_service_token)])


@router.post("/v1/embed")
async def embed(
    *,
    body: EmbedRequest,
    request: Request,
    runtime: Annotated[Runtime, Depends(get_runtime)],
) -> JSONResponse:
    response = await embed_texts(body, runtime)
    logger.info(
        "embedding",
        model=response.model,
        tokensIn=response.tokens_in,
        latencyMs=response.latency_ms,
        status=200,
        requestId=request_id_of(request),
    )
    return JSONResponse(response.model_dump(mode="json", by_alias=True))
