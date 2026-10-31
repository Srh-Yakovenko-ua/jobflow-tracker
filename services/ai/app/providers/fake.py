import asyncio
import hashlib
from pathlib import Path

from app.contracts.embed_request import EmbedRequest
from app.providers.base import Completion, CompletionRequest, Embedding

FIXTURES = Path(__file__).with_name("fixtures")
FAKE_MODEL = "fake"
FAKE_TOKENS_IN = 100
FAKE_TOKENS_OUT = 50


class FakeAiProvider:
    def __init__(
        self, *, replies: list[str] | None = None, delay_seconds: float = 0
    ) -> None:
        self.replies = list(replies or [])
        self.delay_seconds = delay_seconds
        self.requests: list[CompletionRequest] = []
        self.embed_requests: list[EmbedRequest] = []

    async def complete(self, request: CompletionRequest) -> Completion:
        self.requests.append(request)
        await asyncio.sleep(self.delay_seconds)
        text = (
            self.replies.pop(0)
            if self.replies
            else (FIXTURES / f"{request.kind}.json").read_text()
        )
        return Completion(
            text=text,
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
