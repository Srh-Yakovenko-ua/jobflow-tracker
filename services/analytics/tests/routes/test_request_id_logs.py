from typing import TYPE_CHECKING

import pytest
from loguru import logger

from tests.factories import REQUEST_ID
from tests.routes.test_revalidation import fetched, served

if TYPE_CHECKING:
    from loguru import Message

FUNNEL = "/analytics/funnel"


def test_tags_every_line_logged_inside_a_request_with_its_request_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lines: list[Message] = []
    with served(monkeypatch, path=FUNNEL) as app:
        sink = logger.add(lines.append, format="{message}")
        fetched(app, path=FUNNEL)
    logger.info("after the request")
    logger.remove(sink)

    tags = [
        (line.record["message"], line.record["extra"].get("requestId"))
        for line in lines
    ]
    assert tags == [("analytics cache", REQUEST_ID), ("after the request", None)]
