from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import BaseModel, ValidationError

from app.api.deps import get_runtime
from app.core.auth import require_service_token
from app.core.errors import AppError, field_errors
from app.core.request_id import request_id_of
from app.core.structured import Runtime, StructuredCall, complete_structured
from app.prompts import PROMPTS

router = APIRouter(dependencies=[Depends(require_service_token)])


def parsed_body(model: type[BaseModel], body: bytes) -> BaseModel:
    try:
        return model.model_validate_json(body)
    except ValidationError as error:
        raise AppError(422, errors=field_errors(error.errors())) from error


@router.post("/v1/complete/{kind}")
async def complete(
    *, kind: str, request: Request, runtime: Annotated[Runtime, Depends(get_runtime)]
) -> JSONResponse:
    prompt = PROMPTS.get(kind)
    if prompt is None:
        raise AppError(404, detail="Unknown AI kind")
    built = prompt.build(parsed_body(prompt.REQUEST_MODEL, await request.body()))
    result = await complete_structured(
        StructuredCall(kind=kind, prompt=built, output_model=prompt.OUTPUT_MODEL),
        runtime,
    )
    meta = {
        "model": result.model,
        "promptVersion": prompt.PROMPT_VERSION,
        "tokensIn": result.tokens_in,
        "tokensOut": result.tokens_out,
        "latencyMs": result.latency_ms,
    }
    response = prompt.RESPONSE_MODEL.model_validate(
        {**meta, "output": result.output.model_dump(by_alias=True)}
    )
    logger.info(
        "completion", kind=kind, status=200, requestId=request_id_of(request), **meta
    )
    return JSONResponse(response.model_dump(mode="json", by_alias=True))
