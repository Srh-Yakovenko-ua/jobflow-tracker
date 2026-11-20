import re
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import RequestResponseEndpoint

REQUEST_ID_HEADER = "x-request-id"
SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,128}")


def safe_or_new(header: str | None) -> str:
    return (
        safe.group()
        if (safe := SAFE_REQUEST_ID.fullmatch(header or ""))
        else str(uuid4())
    )


def request_id_of(request: Request) -> str:
    return str(getattr(request.state, "request_id", "") or uuid4())


async def echo_request_id(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    request.state.request_id = safe_or_new(request.headers.get(REQUEST_ID_HEADER))
    response = await call_next(request)
    response.headers[REQUEST_ID_HEADER] = request.state.request_id
    return response
