from dataclasses import dataclass
from typing import Any, Protocol

from pydantic import BaseModel


@dataclass(frozen=True, kw_only=True)
class BuiltPrompt:
    system: str
    user: str
    temperature: float
    max_tokens: int


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
