import zipfile
from io import BytesIO
from typing import Literal

from app.core.errors import DocumentError

type FileType = Literal["pdf", "docx", "jpeg", "png"]

MAGIC_BYTES: dict[bytes, FileType] = {
    b"%PDF-": "pdf",
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG\r\n\x1a\n": "png",
}

ZIP_MAGIC = b"PK\x03\x04"
DOCX_PART = "word/document.xml"


def is_docx(data: bytes) -> bool:
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            return DOCX_PART in archive.namelist()
    except zipfile.BadZipFile:
        return False


def detect_type(data: bytes) -> FileType:
    for magic, file_type in MAGIC_BYTES.items():
        if data.startswith(magic):
            return file_type
    if data.startswith(ZIP_MAGIC) and is_docx(data):
        return "docx"
    raise DocumentError("unsupported_type")
