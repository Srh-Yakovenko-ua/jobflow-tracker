from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from app import contracts


class DocumentLimits(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    max_bytes: int = Field(alias="maxBytes", gt=0)
    max_pages: int = Field(alias="maxPages", gt=0)
    scan_pages: int = Field(alias="scanPages", gt=0)
    max_jpeg_bytes: int = Field(alias="maxJpegBytes", gt=0)


LIMITS_FILE = Path(contracts.__file__).with_name("document_limits.json")

LIMITS = TypeAdapter(DocumentLimits).validate_json(LIMITS_FILE.read_bytes())
