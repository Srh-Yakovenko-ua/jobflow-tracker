import sys

from loguru import logger

from app.core.tracing import with_trace_ids


def configure_logging(level: str) -> None:
    logger.remove()
    logger.configure(patcher=with_trace_ids)
    logger.add(sys.stderr, level=level, serialize=True)
