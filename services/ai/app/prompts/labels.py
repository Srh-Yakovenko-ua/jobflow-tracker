from pathlib import Path
from typing import TypedDict

from pydantic import TypeAdapter

from app import contracts


class Labels(TypedDict):
    stages: dict[str, str]
    sources: dict[str, str]
    reasons: dict[str, str]


LABELS = TypeAdapter(Labels).validate_json(
    Path(contracts.__file__).with_name("labels.json").read_bytes()
)

LABELS_BY_FIELD = {
    "stage": LABELS["stages"],
    "source": LABELS["sources"],
    "code": LABELS["reasons"],
}
