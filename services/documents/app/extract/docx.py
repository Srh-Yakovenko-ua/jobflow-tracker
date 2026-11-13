import zipfile
import zlib
from collections.abc import Callable, Iterator
from io import BytesIO

from docx import Document
from docx.document import Document as WordDocument
from docx.opc.constants import NAMESPACE
from docx.opc.exceptions import PackageNotFoundError
from docx.opc.packuri import PackURI
from docx.oxml import parse_xml
from docx.oxml.ns import qn
from docx.oxml.xmlchemy import BaseOxmlElement
from docx.table import Table, _Cell, _Row

from app.contracts.document_extraction import DocumentExtraction, Kind
from app.core.errors import DocumentError

MAX_UNPACKED_BYTES = 50 * 1024 * 1024
MAX_XML_BYTES = 4 * 1024 * 1024
XML_PARTS = (".xml", ".rels")
CONTENT_TYPES = "[Content_Types].xml"
TYPES_NS = f"{{{NAMESPACE.OPC_CONTENT_TYPES}}}"
UNREADABLE_DOCX = (
    zipfile.BadZipFile,
    zlib.error,
    EOFError,
    OSError,
    RuntimeError,
    AttributeError,
    KeyError,
    ValueError,
    SyntaxError,
    PackageNotFoundError,
)


def check_unpacked_size(entries: list[zipfile.ZipInfo]) -> None:
    if sum(entry.file_size for entry in entries) > MAX_UNPACKED_BYTES:
        raise DocumentError("file_too_large", detail="The DOCX unpacks to over 50 MiB")


def check_xml_bytes(size: int) -> None:
    if size > MAX_XML_BYTES:
        raise DocumentError(
            "unreadable_file", detail="The DOCX text parts unpack to over 4 MiB"
        )


def content_types(archive: zipfile.ZipFile) -> Callable[[str], str]:
    check_xml_bytes(archive.getinfo(CONTENT_TYPES).file_size)
    types = parse_xml(archive.read(CONTENT_TYPES))
    overrides: dict[str, str] = {
        item.get("PartName", "").lower(): item.get("ContentType", "")
        for item in types.iterchildren(f"{TYPES_NS}Override")
    }
    defaults: dict[str, str] = {
        item.get("Extension", "").lower(): item.get("ContentType", "")
        for item in types.iterchildren(f"{TYPES_NS}Default")
    }

    def content_type(name: str) -> str:
        part = PackURI(f"/{name}".lower())
        return overrides[part] if part in overrides else defaults.get(part.ext, "")

    return content_type


def check_xml_size(archive: zipfile.ZipFile) -> None:
    content_type = content_types(archive)
    check_xml_bytes(
        sum(
            entry.file_size
            for entry in archive.infolist()
            if entry.filename.endswith(XML_PARTS)
            or content_type(entry.filename).endswith("xml")
        )
    )


def check_package(data: bytes) -> None:
    with zipfile.ZipFile(BytesIO(data)) as archive:
        check_unpacked_size(archive.infolist())
        check_xml_size(archive)


def unwrap_content_controls(body: BaseOxmlElement) -> None:
    for control in body.xpath(".//w:sdt"):
        for child in control.findall(f"{qn('w:sdtContent')}/*"):
            control.addprevious(child)
        control.getparent().remove(control)


def row_text(row: _Row) -> str:
    return "\t".join("\n".join(block_lines(cell)) for cell in dict.fromkeys(row.cells))


def block_lines(container: WordDocument | _Cell) -> Iterator[str]:
    for block in container.iter_inner_content():
        if isinstance(block, Table):
            yield from (row_text(row) for row in block.rows)
        else:
            yield block.text


def body_lines(data: bytes) -> Iterator[str]:
    document = Document(BytesIO(data))
    unwrap_content_controls(document.element.body)
    yield from block_lines(document)


def extract_docx(data: bytes) -> DocumentExtraction:
    try:
        check_package(data)
        lines = [line.strip() for line in body_lines(data)]
    except UNREADABLE_DOCX as error:
        raise DocumentError("unreadable_file") from error
    return DocumentExtraction(
        kind=Kind.text,
        text="\n".join(line for line in lines if line),
        pages=[],
        page_count=1,
    )
