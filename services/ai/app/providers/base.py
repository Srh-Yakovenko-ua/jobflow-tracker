from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from loguru import logger

from app.contracts.embed_request import EmbedRequest
from app.core.errors import AppError, timeout_error


@dataclass(frozen=True, kw_only=True)
class Message:
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True, kw_only=True)
class CompletionRequest:
    kind: str
    system: str
    messages: list[Message]
    output_schema: dict[str, Any]
    temperature: float
    max_tokens: int


@dataclass(frozen=True, kw_only=True)
class Completion:
    text: str
    model: str
    tokens_in: int
    tokens_out: int


@dataclass(frozen=True, kw_only=True)
class Embedding:
    vectors: list[list[float]]
    model: str
    tokens_in: int


class AiProvider(Protocol):
    async def complete(self, request: CompletionRequest) -> Completion: ...

    async def embed(self, request: EmbedRequest) -> Embedding: ...


@dataclass(frozen=True, kw_only=True)
class VendorSettings:
    api_key: str
    model: str
    embedding_model: str
    base_url: str | None
    timeout_seconds: float
    max_retries: int
    nvidia: bool = False


@dataclass(frozen=True, kw_only=True)
class VendorErrors:
    timeout: type[Exception]
    rate_limited: type[Exception]
    failed: type[Exception]


@contextmanager
def vendor_errors(errors: VendorErrors, vendor: VendorSettings) -> Iterator[None]:
    try:
        yield
    except errors.timeout as error:
        logger.warning("vendor timeout", model=vendor.model)
        raise timeout_error(vendor.timeout_seconds) from error
    except errors.rate_limited as error:
        logger.warning("vendor rate limit", model=vendor.model)
        raise AppError(429, detail="The AI provider is rate limiting") from error
    except errors.failed as error:
        logger.warning("vendor error", model=vendor.model, error=type(error).__name__)
        raise AppError(502, detail="The AI provider failed") from error
