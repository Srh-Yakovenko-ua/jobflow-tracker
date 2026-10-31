from collections.abc import Mapping
from pathlib import Path

from pydantic import TypeAdapter

from app import contracts
from app.prompts import vacancy_parse
from app.prompts.base import PromptModule

PROMPTS: dict[str, PromptModule] = {"vacancy_parse": vacancy_parse}

PROMPT_VERSIONS_FILE = Path(contracts.__file__).with_name("prompt_versions.json")


class PromptVersionMismatchError(RuntimeError):
    pass


def load_prompt_versions() -> dict[str, str]:
    return TypeAdapter(dict[str, str]).validate_json(PROMPT_VERSIONS_FILE.read_bytes())


def module_version(kind: str) -> str | None:
    prompt = PROMPTS.get(kind)
    return None if prompt is None else prompt.PROMPT_VERSION


def check_prompt_versions(expected: Mapping[str, str]) -> None:
    mismatches = [
        f"{kind}: AI_PROMPT_VERSIONS {expected.get(kind, 'none')}, prompt module {module_version(kind) or 'none'}"
        for kind in sorted(expected.keys() | PROMPTS.keys())
        if expected.get(kind) != module_version(kind)
    ]
    if mismatches:
        raise PromptVersionMismatchError("; ".join(mismatches))
