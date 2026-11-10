import asyncio
import hashlib
import json
from collections.abc import Callable
from pathlib import Path
from typing import NoReturn

from app.contracts.embed_request import EmbedRequest
from app.core.errors import provider_error, timeout_error
from app.providers.base import Completion, CompletionRequest, Embedding

FIXTURES = Path(__file__).with_name("fixtures")
FAKE_MODEL = "fake"
FAKE_TOKENS_IN = 100
FAKE_TOKENS_OUT = 50
NOT_STATED = {"value": None, "confidence": "missing", "evidence": None}


def fixture_of(kind: str) -> str:
    return (FIXTURES / f"{kind}.json").read_text()


class FakeAiProvider:
    def __init__(
        self,
        *,
        replies: list[str] | None = None,
        delay_seconds: float = 0,
        timeout_seconds: float = 0,
    ) -> None:
        self.replies = list(replies or [])
        self.delay_seconds = delay_seconds
        self.timeout_seconds = timeout_seconds
        self.requests: list[CompletionRequest] = []
        self.embed_requests: list[EmbedRequest] = []

    def reply_to(self, request: CompletionRequest) -> str:
        asked = request.messages[-1].content
        for marker, fail in FAILURES.items():
            if marker in asked:
                return fail(self, request)
        return self.replies.pop(0) if self.replies else fixture_of(request.kind)

    async def complete(self, request: CompletionRequest) -> Completion:
        self.requests.append(request)
        await asyncio.sleep(self.delay_seconds)
        return Completion(
            text=self.reply_to(request),
            model=FAKE_MODEL,
            tokens_in=FAKE_TOKENS_IN,
            tokens_out=FAKE_TOKENS_OUT,
        )

    async def embed(self, request: EmbedRequest) -> Embedding:
        self.embed_requests.append(request)
        texts = [text.root for text in request.texts]
        return Embedding(
            vectors=[
                [byte / 255 for byte in hashlib.sha256(text.encode()).digest()]
                for text in texts
            ],
            model=FAKE_MODEL,
            tokens_in=sum(len(text.split()) for text in texts),
        )


def timed_out(fake: FakeAiProvider, request: CompletionRequest) -> NoReturn:
    raise timeout_error(fake.timeout_seconds)


def provider_failed(fake: FakeAiProvider, request: CompletionRequest) -> NoReturn:
    raise provider_error()


def without_company_and_position(
    fake: FakeAiProvider, request: CompletionRequest
) -> str:
    stated = json.loads(fixture_of(request.kind))
    return json.dumps({**stated, "company": NOT_STATED, "position": NOT_STATED})


FAILURES: dict[str, Callable[[FakeAiProvider, CompletionRequest], str]] = {
    "fake-ai-fail:ai_timeout": timed_out,
    "fake-ai-fail:ai_provider_error": provider_failed,
    "fake-ai-fail:no_company_no_position": without_company_and_position,
}
