import time

import pytest

from app.core.errors import DocumentError
from app.extract.docx import extract_docx
from tests.factories import (
    RENAMED_DOCUMENT,
    UPPER_CASE_DEFAULT,
    UPPER_CASE_OVERRIDE,
    bloated_xml_docx,
    broken_docx,
    corrupt_deflate_docx,
    empty_docx,
    encrypted_entry_docx,
    resume_docx,
    sibling_controls_docx,
    template_docx,
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


def test_reads_content_controls_and_nested_tables_in_document_order() -> None:
    assert extract_docx(template_docx()).text == (
        "Jane Doe\nSenior Python developer\nCity: Kyiv\n"
        "Acme Corp\tStack\nFastAPI\tpandas\n"
        "References on request"
    )


def test_unwraps_many_sibling_content_controls_in_linear_time() -> None:
    data = sibling_controls_docx(50_000)
    started = time.perf_counter()
    text = extract_docx(data).text

    assert (text, time.perf_counter() - started < 0.5) == ("", True)


def test_returns_empty_text_for_an_empty_document() -> None:
    assert extract_docx(empty_docx()).text == ""


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (broken_docx(), (422, "unreadable_file")),
        (corrupt_deflate_docx(), (422, "unreadable_file")),
        (unsupported_method_docx(), (422, "unreadable_file")),
        (wrong_root_docx(), (422, "unreadable_file")),
        (encrypted_entry_docx(), (422, "unreadable_file")),
        (bloated_xml_docx(), (422, "unreadable_file")),
        (bloated_xml_docx(document_name=RENAMED_DOCUMENT), (422, "unreadable_file")),
        (
            bloated_xml_docx(
                document_name=RENAMED_DOCUMENT, types_edit=UPPER_CASE_OVERRIDE
            ),
            (422, "unreadable_file"),
        ),
        (
            bloated_xml_docx(
                document_name=RENAMED_DOCUMENT, types_edit=UPPER_CASE_DEFAULT
            ),
            (422, "unreadable_file"),
        ),
        (resume_docx(extra_entry_bytes=51 * 1024 * 1024), (413, "file_too_large")),
    ],
    ids=[
        "broken-xml",
        "corrupt-deflate",
        "unsupported-method",
        "wrong-root",
        "encrypted-entry",
        "xml-parts-over-cap",
        "xml-part-renamed-over-cap",
        "xml-part-upper-case-override-over-cap",
        "xml-part-upper-case-default-over-cap",
        "unpacks-past-fifty-mib",
    ],
)
def test_refuses_a_docx_it_cannot_read(data: bytes, expected: tuple[int, str]) -> None:
    with pytest.raises(DocumentError) as raised:
        extract_docx(data)

    assert (raised.value.status, raised.value.type) == expected
