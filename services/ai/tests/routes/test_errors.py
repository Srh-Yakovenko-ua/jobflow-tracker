from typing import TYPE_CHECKING

import httpx
import pytest
from loguru import logger

from tests.factories import auth_headers, build_app

if TYPE_CHECKING:
    from loguru import Message

pytestmark = pytest.mark.anyio

BROKEN_PATH = "/v1/broken"


async def broken_route() -> None:
    raise RuntimeError


async def test_a_500_logs_request_failed_at_error_and_the_unhandled_error_line_carries_the_request_id() -> (
    None
):
    app = build_app()
    app.add_api_route(BROKEN_PATH, broken_route)
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    lines: list[Message] = []
    sink = logger.add(lines.append, level="INFO")
    async with httpx.AsyncClient(
        transport=transport, base_url="http://ai.test"
    ) as client:
        response = await client.get(BROKEN_PATH, headers=auth_headers())
    logger.remove(sink)

    logged = [
        (
            line.record["level"].name,
            line.record["message"],
            line.record["extra"].get("requestId"),
        )
        for line in lines
    ]
    assert (response.status_code, response.json()["requestId"]) == (500, "req-test")
    assert logged == [
        ("ERROR", "unhandled error", "req-test"),
        ("ERROR", "request failed", "req-test"),
    ]
