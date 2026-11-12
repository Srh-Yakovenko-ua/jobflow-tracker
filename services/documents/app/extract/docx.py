import zipfile
import zlib
from collections.abc import Iterator
from io import BytesIO

from docx import Document
from docx.opc.exceptions import PackageNotFoundError
from docx.table import Table, _Row

from app.contracts.document_extraction import DocumentExtraction, Kind
from app.core.errors import DocumentError

MAX_UNPACKED_BYTES = 50 * 1024 * 1024
UNREADABLE_DOCX = (
    zipfile.BadZipFile,
    zlib.error,
    EOFError,
    OSError,
    NotImplementedError,
    AttributeError,
    KeyError,
    ValueError,
    SyntaxError,
    PackageNotFoundError,
)


def check_unpacked_size(data: bytes) -> None:
    with zipfile.ZipFile(BytesIO(data)) as archive:
        unpacked = sum(entry.file_size for entry in archive.infolist())
    if unpacked > MAX_UNPACKED_BYTES:
        raise DocumentError("file_too_large", detail="The DOCX unpacks to over 50 MiB")


def row_text(row: _Row) -> str:
    return "\t".join(cell.text for cell in dict.fromkeys(row.cells))


def body_lines(data: bytes) -> Iterator[str]:
    for block in Document(BytesIO(data)).iter_inner_content():
        if isinstance(block, Table):
            yield from (row_text(row) for row in block.rows)
        else:
            yield block.text


def extract_docx(data: bytes) -> DocumentExtraction:
    try:
        check_unpacked_size(data)
        lines = [line.strip() for line in body_lines(data)]
    except UNREADABLE_DOCX as error:
        raise DocumentError("unreadable_file") from error
    return DocumentExtraction(
        kind=Kind.text,
        text="\n".join(line for line in lines if line),
        pages=[],
        page_count=1,
    )
