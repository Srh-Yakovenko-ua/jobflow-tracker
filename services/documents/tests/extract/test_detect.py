import pytest

from app.core.errors import DocumentError
from app.extract.detect import detect_type
from tests.factories import phone_jpeg, resume_docx, two_page_pdf, zip_without_document

PNG_HEADER = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"


@pytest.mark.parametrize(
    ("data", "file_type"),
    [
        (two_page_pdf(), "pdf"),
        (resume_docx(), "docx"),
        (phone_jpeg(), "jpeg"),
        (PNG_HEADER, "png"),
    ],
    ids=["pdf", "docx", "jpeg", "png"],
)
def test_names_the_type_from_magic_bytes(data: bytes, file_type: str) -> None:
    assert detect_type(data) == file_type


@pytest.mark.parametrize(
    "data",
    [b"GIF89a\x01\x00\x01\x00", zip_without_document(), b"PK\x03\x04broken", b""],
    ids=["gif", "zip-without-word-document", "broken-zip", "empty"],
)
def test_refuses_any_other_type(data: bytes) -> None:
    with pytest.raises(DocumentError) as raised:
        detect_type(data)

    assert (raised.value.status, raised.value.type) == (415, "unsupported_type")
