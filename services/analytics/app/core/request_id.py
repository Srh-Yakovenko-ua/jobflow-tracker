import re
from uuid import uuid4

from loguru import logger
from starlette.datastructures import Headers, MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "x-request-id"
SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,128}")


def accepted_request_id(incoming: str | None) -> str:
    return (
        incoming if incoming and SAFE_REQUEST_ID.fullmatch(incoming) else str(uuid4())
    )


def request_id_from(request: Request) -> str:
    return str(request.scope.get("state", {}).get("request_id") or uuid4())


class RequestIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = accepted_request_id(Headers(scope=scope).get(REQUEST_ID_HEADER))
        scope.setdefault("state", {})["request_id"] = request_id

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message).append(REQUEST_ID_HEADER, request_id)
            await send(message)

        with logger.contextualize(requestId=request_id):
            await self.app(scope, receive, send_with_request_id)
