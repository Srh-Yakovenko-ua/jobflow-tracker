import sys

from loguru import logger

from app.core.tracing import with_trace_ids


def configure_logging(level: str) -> None:
    logger.configure(
        handlers=[{"sink": sys.stderr, "level": level, "serialize": True}],
        patcher=with_trace_ids,
    )
