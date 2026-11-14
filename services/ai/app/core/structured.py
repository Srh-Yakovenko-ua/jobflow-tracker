import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace

from pydantic import BaseModel, ValidationError

from app.contracts.embed_request import EmbedRequest, Text
from app.contracts.embed_response import EmbedResponse
from app.core.errors import (
    INVALID_OUTPUT,
    AppError,
    FieldError,
    field_errors,
    timeout_error,
)
from app.core.limiter import RateLimiter
from app.core.pii import scrub
from app.prompts.base import BuiltPrompt
from app.providers.base import AiProvider, Completion, CompletionRequest, Message


@dataclass(frozen=True, kw_only=True)
class Runtime:
    provider: AiProvider
    limiter: RateLimiter
    timeout_seconds: float
    vision_enabled: bool


@dataclass(frozen=True, kw_only=True)
class StructuredCall:
    kind: str
    prompt: BuiltPrompt
    output_model: type[BaseModel]


@dataclass(frozen=True, kw_only=True)
class StructuredResult:
    output: BaseModel
    model: str
    tokens_in: int
    tokens_out: int
    latency_ms: int


def elapsed_ms(started: float) -> int:
    return round((time.perf_counter() - started) * 1000)


async def vendor_call[T](call: Callable[[], Awaitable[T]], runtime: Runtime) -> T:
    runtime.limiter.acquire()
    try:
        async with asyncio.timeout(runtime.timeout_seconds):
            return await call()
    except TimeoutError as error:
        raise timeout_error(runtime.timeout_seconds) from error


async def attempt(request: CompletionRequest, runtime: Runtime) -> Completion:
    safe = replace(
        request,
        messages=[
            replace(message, content=scrub(message.content))
            for message in request.messages
        ],
    )
    return await vendor_call(lambda: runtime.provider.complete(safe), runtime)


def schema_repair(error: ValidationError) -> str:
    problems = "; ".join(
        f"{field.path or 'answer'}: {field.message}"
        for field in field_errors(error.errors())
    )
    return f"Your answer did not match the JSON schema: {problems}. Answer again with JSON that matches the schema."


def rules_repair(problems: list[str]) -> str:
    return f"Your answer broke these rules: {'; '.join(problems)}. Write the fields these rules name again from the start and change them as the rules say; a copy of your previous answer is rejected. Answer with JSON that matches the schema and keeps every rule."


def repair_request(
    request: CompletionRequest, *, answer: Completion, repair: str
) -> CompletionRequest:
    return replace(
        request,
        messages=[
            *request.messages,
            Message(role="assistant", content=answer.text),
            Message(role="user", content=repair),
        ],
    )


def checked_answer(
    call: StructuredCall, answer: Completion
) -> tuple[BaseModel, list[str]]:
    output = call.output_model.model_validate_json(answer.text)
    problems = call.prompt.problems
    return output, [] if problems is None else problems(output)


def repaired_output(call: StructuredCall, answer: Completion) -> BaseModel:
    try:
        output, problems = checked_answer(call, answer)
    except ValidationError as error:
        raise AppError(
            422,
            problem=INVALID_OUTPUT,
            detail="The model output did not match the schema after one repair",
            errors=field_errors(error.errors()),
        ) from error
    if problems:
        raise AppError(
            422,
            problem=INVALID_OUTPUT,
            detail="The model output broke the kind's rules after one repair",
            errors=[FieldError(path="output", message=problem) for problem in problems],
        )
    return output


async def validated_answers(
    call: StructuredCall, *, request: CompletionRequest, runtime: Runtime
) -> tuple[BaseModel, list[Completion]]:
    first = await attempt(request, runtime)
    try:
        output, problems = checked_answer(call, first)
    except ValidationError as error:
        repair = schema_repair(error)
    else:
        if not problems:
            return output, [first]
        repair = rules_repair(problems)
    second = await attempt(
        repair_request(request, answer=first, repair=repair), runtime
    )
    return repaired_output(call, second), [first, second]


async def complete_structured(
    call: StructuredCall, runtime: Runtime
) -> StructuredResult:
    started = time.perf_counter()
    request = CompletionRequest(
        kind=call.kind,
        system=call.prompt.system,
        messages=[
            Message(role="user", content=call.prompt.user, images=call.prompt.images)
        ],
        output_schema=call.output_model.model_json_schema(by_alias=True),
        temperature=call.prompt.temperature,
        max_tokens=call.prompt.max_tokens,
    )
    output, answers = await validated_answers(call, request=request, runtime=runtime)
    return StructuredResult(
        output=output,
        model=answers[-1].model,
        tokens_in=sum(answer.tokens_in for answer in answers),
        tokens_out=sum(answer.tokens_out for answer in answers),
        latency_ms=elapsed_ms(started),
    )


async def embed_texts(request: EmbedRequest, runtime: Runtime) -> EmbedResponse:
    started = time.perf_counter()
    safe = request.model_copy(
        update={
            "texts": [Text.model_construct(scrub(text.root)) for text in request.texts]
        }
    )
    embedding = await vendor_call(lambda: runtime.provider.embed(safe), runtime)
    return EmbedResponse(
        vectors=embedding.vectors,
        model=embedding.model,
        tokens_in=embedding.tokens_in,
        latency_ms=elapsed_ms(started),
    )
