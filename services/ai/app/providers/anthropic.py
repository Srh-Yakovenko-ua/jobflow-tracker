import json

import anthropic
import httpx2
from anthropic import AsyncAnthropic
from anthropic.types import MessageParam, ToolUseBlock

from app.contracts.embed_request import EmbedRequest
from app.core.errors import AppError
from app.providers.base import (
    Completion,
    CompletionRequest,
    Embedding,
    VendorErrors,
    VendorSettings,
    vendor_errors,
)

ANTHROPIC_ERRORS = VendorErrors(
    timeout=anthropic.APITimeoutError,
    rate_limited=anthropic.RateLimitError,
    failed=anthropic.APIError,
)


class AnthropicProvider:
    def __init__(
        self, vendor: VendorSettings, *, http_client: httpx2.AsyncClient | None = None
    ) -> None:
        self.vendor = vendor
        self.client = AsyncAnthropic(
            api_key=vendor.api_key,
            base_url=vendor.base_url,
            timeout=vendor.timeout_seconds,
            max_retries=vendor.max_retries,
            http_client=http_client,
        )

    async def complete(self, request: CompletionRequest) -> Completion:
        tool_name = f"submit_{request.kind}"
        messages: list[MessageParam] = [
            {"role": message.role, "content": message.content}
            for message in request.messages
        ]
        with vendor_errors(ANTHROPIC_ERRORS, self.vendor):
            response = await self.client.messages.create(
                model=self.vendor.model,
                max_tokens=request.max_tokens,
                system=request.system,
                messages=messages,
                tools=[
                    {
                        "name": tool_name,
                        "description": f"Submit the {request.kind} result.",
                        "input_schema": request.output_schema,
                    }
                ],
                tool_choice={"type": "tool", "name": tool_name},
                extra_body={"temperature": request.temperature},
            )
        tool_input = next(
            (
                block.input
                for block in response.content
                if isinstance(block, ToolUseBlock)
            ),
            None,
        )
        return Completion(
            text="" if tool_input is None else json.dumps(tool_input),
            model=response.model,
            tokens_in=response.usage.input_tokens,
            tokens_out=response.usage.output_tokens,
        )

    async def embed(self, request: EmbedRequest) -> Embedding:
        raise AppError(501, detail="Anthropic has no embeddings API")
