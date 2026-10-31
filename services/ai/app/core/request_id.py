import re
from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import Request, Response

REQUEST_ID_HEADER = "x-request-id"

SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,128}")


def pick_request_id(incoming: str | None) -> str:
    if incoming is not None and SAFE_REQUEST_ID.fullmatch(incoming):
        return incoming
    return str(uuid4())


def request_id_of(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    return request_id if isinstance(request_id, str) else str(uuid4())


async def assign_request_id(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request_id = pick_request_id(request.headers.get(REQUEST_ID_HEADER))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers[REQUEST_ID_HEADER] = request_id
    return response
