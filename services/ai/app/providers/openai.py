import re

import httpx2
import openai
from openai import AsyncOpenAI, omit
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionUserMessageParam,
)

from app.contracts.embed_request import EmbedRequest
from app.core.errors import AppError
from app.providers.base import (
    Completion,
    CompletionRequest,
    Embedding,
    Message,
    VendorErrors,
    VendorSettings,
    vendor_errors,
)

OPENAI_ERRORS = VendorErrors(
    timeout=openai.APITimeoutError,
    rate_limited=openai.RateLimitError,
    failed=openai.APIError,
)

THINKING_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)


def chat_message(message: Message) -> ChatCompletionMessageParam:
    if message.role == "assistant":
        return ChatCompletionAssistantMessageParam(
            role="assistant", content=message.content
        )
    return ChatCompletionUserMessageParam(role="user", content=message.content)


class OpenAiProvider:
    def __init__(
        self, vendor: VendorSettings, *, http_client: httpx2.AsyncClient | None = None
    ) -> None:
        self.vendor = vendor
        self.client = AsyncOpenAI(
            api_key=vendor.api_key,
            base_url=vendor.base_url,
            timeout=vendor.timeout_seconds,
            max_retries=vendor.max_retries,
            http_client=http_client,
        )

    async def complete(self, request: CompletionRequest) -> Completion:
        with vendor_errors(OPENAI_ERRORS, self.vendor):
            response = await self.client.chat.completions.create(
                model=self.vendor.model,
                messages=[
                    {"role": "system", "content": request.system},
                    *map(chat_message, request.messages),
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": request.kind,
                        "strict": False,
                        "schema": request.output_schema,
                    },
                },
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                reasoning_effort="none" if self.vendor.nvidia else omit,
            )
        content = response.choices[0].message.content if response.choices else None
        usage = response.usage
        return Completion(
            text=THINKING_BLOCK.sub("", content or "").strip(),
            model=response.model,
            tokens_in=usage.prompt_tokens if usage else 0,
            tokens_out=usage.completion_tokens if usage else 0,
        )

    async def embed(self, request: EmbedRequest) -> Embedding:
        if not self.vendor.embedding_model:
            raise AppError(501, detail="Embeddings are not configured")
        with vendor_errors(OPENAI_ERRORS, self.vendor):
            response = await self.client.embeddings.create(
                model=self.vendor.embedding_model,
                input=[text.root for text in request.texts],
                encoding_format="float",
                extra_body={"input_type": request.input_type.value}
                if self.vendor.nvidia
                else None,
            )
        return Embedding(
            vectors=[item.embedding for item in response.data],
            model=response.model,
            tokens_in=response.usage.prompt_tokens,
        )
