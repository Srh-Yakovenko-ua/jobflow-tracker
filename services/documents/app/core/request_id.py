from uuid import UUID, uuid4

from fastapi import Request, Response
from starlette.middleware.base import RequestResponseEndpoint

REQUEST_ID_HEADER = "x-request-id"


def uuid_or_new(header: str | None) -> str:
    try:
        return str(UUID(header or ""))
    except ValueError:
        return str(uuid4())


def request_id_of(request: Request) -> str:
    return str(getattr(request.state, "request_id", "") or uuid4())


async def echo_request_id(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    request.state.request_id = uuid_or_new(request.headers.get(REQUEST_ID_HEADER))
    response = await call_next(request)
    response.headers[REQUEST_ID_HEADER] = request.state.request_id
    return response
