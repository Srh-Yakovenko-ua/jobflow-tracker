from typing import TYPE_CHECKING

from loguru import logger
from opentelemetry import trace
from opentelemetry.trace import NonRecordingSpan, SpanContext

from app.core.logging import configure_logging

if TYPE_CHECKING:
    from loguru import Message

ACTIVE_SPAN = SpanContext(
    trace_id=0x0AF7651916CD43DD8448EB211C80319C,
    span_id=0xB7AD6B7169203331,
    is_remote=False,
)


def test_tags_a_line_logged_inside_a_span_with_its_trace_and_span_ids() -> None:
    configure_logging("INFO")
    lines: list[Message] = []
    sink = logger.add(lines.append, format="{message}")
    with trace.use_span(NonRecordingSpan(ACTIVE_SPAN)):
        logger.info("inside a span")
    logger.info("outside a span")
    logger.remove(sink)

    assert [(line.record["message"], line.record["extra"]) for line in lines] == [
        (
            "inside a span",
            {
                "trace_id": "0af7651916cd43dd8448eb211c80319c",
                "span_id": "b7ad6b7169203331",
            },
        ),
        ("outside a span", {}),
    ]
