import sys

from loguru import logger


def configure_logging(level: str) -> None:
    logger.configure(handlers=[{"sink": sys.stderr, "level": level, "serialize": True}])
