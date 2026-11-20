import re
from collections.abc import Callable
from dataclasses import dataclass
from functools import partial
from typing import Any, Protocol, TypedDict

from pydantic import BaseModel

WORD = re.compile(r"[^\W_]")
DIGITS = re.compile(r"[0-9]+")


@dataclass(frozen=True, kw_only=True)
class BuiltPrompt:
    system: str
    user: str
    temperature: float
    max_tokens: int
    images: tuple[str, ...] = ()
    problems: Callable[[BaseModel], list[str]] | None = None
    parse: Callable[[str], BaseModel] | None = None


class PromptModule(Protocol):
    @property
    def PROMPT_VERSION(self) -> str: ...

    @property
    def REQUEST_MODEL(self) -> type[BaseModel]: ...

    @property
    def OUTPUT_MODEL(self) -> type[BaseModel]: ...

    @property
    def RESPONSE_MODEL(self) -> type[BaseModel]: ...

    def build(self, request: Any) -> BuiltPrompt: ...

    def checked(self, request: Any, output: Any) -> BaseModel: ...


class Sampled(Protocol):
    @property
    def temperature(self) -> float | None: ...

    @property
    def max_tokens(self) -> int | None: ...


class Fed(Protocol):
    @property
    def input(self) -> BaseModel: ...


class Sampling(TypedDict):
    temperature: float
    max_tokens: int


def sampling(request: Sampled, *, temperature: float, max_tokens: int) -> Sampling:
    return {
        "temperature": temperature
        if request.temperature is None
        else request.temperature,
        "max_tokens": request.max_tokens or max_tokens,
    }


@dataclass(frozen=True, kw_only=True)
class RuledKind[R: Sampled, O: BaseModel]:
    system: str
    temperature: float
    max_tokens: int
    output_model: type[O]
    user: Callable[[R], str]
    problems: Callable[[R, O], list[str]]
    parse: Callable[[R, str], O] | None = None


def ruled_prompt[R: Sampled, O: BaseModel](
    request: R, kind: RuledKind[R, O]
) -> BuiltPrompt:
    def problems(output: BaseModel) -> list[str]:
        return kind.problems(request, kind.output_model.model_validate(output))

    return BuiltPrompt(
        parse=None if kind.parse is None else partial(kind.parse, request),
        system=kind.system,
        user=kind.user(request),
        problems=problems,
        **sampling(request, temperature=kind.temperature, max_tokens=kind.max_tokens),
    )


def delimiter_tag(name: str) -> re.Pattern[str]:
    return re.compile(rf"<\s*/?\s*{name}\b[^>]*>", re.IGNORECASE)


def without_delimiter_tags(text: str, tag: re.Pattern[str]) -> str:
    removed = 1
    while removed:
        text, removed = tag.subn("", text)
    return text


def fenced(text: str, *, name: str, strip: re.Pattern[str] | None = None) -> str:
    kept = without_delimiter_tags(text, strip or delimiter_tag(name))
    return f"<{name}>\n{kept}\n</{name}>"


def input_json(request: Fed) -> str:
    return request.input.model_dump_json(by_alias=True)


def input_numbers(request: Fed) -> set[int]:
    return set(numbers_in(input_json(request)))


def collapsed(text: str) -> str:
    return " ".join(text.split())


def normalised(text: str) -> str:
    return collapsed(text).lower()


def word_count(text: str) -> int:
    return sum(1 for token in text.split() if WORD.search(token))


def numbers_in(text: str) -> list[int]:
    return [int(run) for run in DIGITS.findall(text)]


def invented_numbers(text: str, given: set[int]) -> list[str]:
    invented = dict.fromkeys(
        number for number in numbers_in(text) if number not in given
    )
    return [f"the number {number} is not in the input" for number in invented]
