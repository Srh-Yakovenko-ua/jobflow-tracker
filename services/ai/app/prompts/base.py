import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol

from pydantic import BaseModel


@dataclass(frozen=True, kw_only=True)
class BuiltPrompt:
    system: str
    user: str
    temperature: float
    max_tokens: int
    images: tuple[str, ...] = ()
    problems: Callable[[BaseModel], list[str]] | None = None


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


def delimiter_tag(name: str) -> re.Pattern[str]:
    return re.compile(rf"<\s*/?\s*{name}\b[^>]*>", re.IGNORECASE)


def without_delimiter_tags(text: str, tag: re.Pattern[str]) -> str:
    removed = 1
    while removed:
        text, removed = tag.subn("", text)
    return text


def collapsed(text: str) -> str:
    return " ".join(text.split())
