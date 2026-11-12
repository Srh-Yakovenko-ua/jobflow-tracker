import pytest

from app.core.errors import DocumentError
from app.extract.docx import extract_docx
from tests.factories import (
    broken_docx,
    corrupt_deflate_docx,
    empty_docx,
    resume_docx,
    unsupported_method_docx,
    wrong_root_docx,
)


def test_reads_paragraphs_and_table_rows_in_document_order() -> None:
    extraction = extract_docx(resume_docx())

    assert (extraction.kind.value, extraction.page_count, extraction.pages) == (
        "text",
        1,
        [],
    )
    assert extraction.text == (
        "Jane Doe\nSenior Python developer\n"
        "Acme Corp\t2021-2026\nFastAPI\t\tpandas\n"
        "References on request"
    )


def test_returns_empty_text_for_an_empty_document() -> None:
    assert extract_docx(empty_docx()).text == ""


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (broken_docx(), (422, "unreadable_file")),
        (corrupt_deflate_docx(), (422, "unreadable_file")),
        (unsupported_method_docx(), (422, "unreadable_file")),
        (wrong_root_docx(), (422, "unreadable_file")),
        (resume_docx(extra_entry_bytes=51 * 1024 * 1024), (413, "file_too_large")),
    ],
    ids=[
        "broken-xml",
        "corrupt-deflate",
        "unsupported-method",
        "wrong-root",
        "unpacks-past-fifty-mib",
    ],
)
def test_refuses_a_docx_it_cannot_read(data: bytes, expected: tuple[int, str]) -> None:
    with pytest.raises(DocumentError) as raised:
        extract_docx(data)

    assert (raised.value.status, raised.value.type) == expected
