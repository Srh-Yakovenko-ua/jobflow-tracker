import base64

import pytest

from app.core.errors import DocumentError
from app.extract.pdf import extract_pdf
from tests.factories import (
    MAX_JPEG_BYTES,
    encrypted_pdf,
    image_pdf,
    scan_pdf,
    text_pdf,
    two_page_pdf,
)
from tests.jpeg import jpeg_size


def test_reads_the_text_layer_page_by_page() -> None:
    extraction = extract_pdf(two_page_pdf())

    assert (extraction.kind.value, extraction.page_count, extraction.pages) == (
        "text",
        2,
        [],
    )
    assert extraction.text == (
        "Jane Doe\nSenior Python developer\nBuilds data services for hiring teams\n\n"
        "Experience: Acme Corp 2021-2026\nSkills: FastAPI, pandas, SQL\n"
        "Languages: English C1, Ukrainian native"
    )


def test_opens_a_pdf_locked_only_by_an_owner_password() -> None:
    extraction = extract_pdf(encrypted_pdf(user_password=""))

    assert (extraction.kind.value, extraction.text.splitlines()[0]) == (
        "text",
        "Jane Doe",
    )


def test_renders_the_first_three_pages_of_a_scan_under_the_jpeg_cap() -> None:
    extraction = extract_pdf(scan_pdf(4))

    assert (extraction.kind.value, extraction.text, extraction.page_count) == (
        "scan",
        "",
        4,
    )
    assert [page.index for page in extraction.pages] == [0, 1, 2]
    for page in extraction.pages:
        jpeg = base64.b64decode(page.jpeg_base64)
        assert len(jpeg) == page.bytes <= MAX_JPEG_BYTES
        assert max(jpeg_size(jpeg)) <= 1600


def test_renders_a_page_with_a_large_embedded_image_at_the_capped_size() -> None:
    extraction = extract_pdf(image_pdf(width=4000, height=5000))

    assert (extraction.kind.value, extraction.page_count, len(extraction.pages)) == (
        "scan",
        1,
        1,
    )
    jpeg = base64.b64decode(extraction.pages[0].jpeg_base64)
    assert (jpeg_size(jpeg), len(jpeg) <= MAX_JPEG_BYTES) == ((1237, 1600), True)


def test_treats_a_pdf_under_fifty_characters_a_page_as_a_scan() -> None:
    extraction = extract_pdf(text_pdf([["Page one has a few words"], ["and two"]]))

    assert (extraction.kind.value, len(extraction.pages)) == ("scan", 2)


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (encrypted_pdf(user_password="user-secret"), (422, "encrypted_pdf")),
        (b"%PDF-1.7\nnot a real document", (422, "unreadable_file")),
        (text_pdf([["Overflow page with enough text"]] * 21), (413, "file_too_large")),
        (image_pdf(width=8000, height=7000), (422, "unreadable_file")),
    ],
    ids=["encrypted", "corrupt", "over-twenty-pages", "image-over-the-pixel-cap"],
)
def test_refuses_a_pdf_it_cannot_read(data: bytes, expected: tuple[int, str]) -> None:
    with pytest.raises(DocumentError) as raised:
        extract_pdf(data)

    assert (raised.value.status, raised.value.type) == expected
