import base64
import json
import time

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from loguru import logger

from tests.factories import (
    MAX_JPEG_BYTES,
    corrupt_deflate_docx,
    encrypted_pdf,
    oversized_pdf,
    resume_docx,
    scan_pdf,
    text_pdf,
    two_page_pdf,
    unsupported_method_docx,
    zip_without_document,
)

EXTRACT_PATH = "/documents/extract"
REQUEST_ID = "0b6c8f9e-2a4d-4e1f-9c3b-5d7a8e6f1b2c"


def post_file(client: TestClient, data: bytes) -> Response:
    return client.post(
        EXTRACT_PATH,
        files={"file": ("upload.bin", data, "application/octet-stream")},
        headers={"x-request-id": REQUEST_ID},
    )


@pytest.mark.parametrize(
    "case",
    [
        (
            two_page_pdf(),
            2,
            ["Senior Python developer", "Skills: FastAPI, pandas, SQL"],
        ),
        (resume_docx(), 1, ["Senior Python developer", "Acme Corp\t2021-2026"]),
    ],
    ids=["text_pdf", "docx"],
)
def test_returns_text_for_a_text_document_within_two_seconds(
    client: TestClient, case: tuple[bytes, int, list[str]]
) -> None:
    data, page_count, phrases = case
    started = time.perf_counter()
    response = post_file(client, data)
    elapsed = time.perf_counter() - started

    body = response.json()
    assert (response.status_code, sorted(body), body["kind"], body["pageCount"]) == (
        200,
        ["kind", "pageCount", "pages", "text"],
        "text",
        page_count,
    )
    positions = [body["text"].index(phrase) for phrase in phrases]
    assert (positions == sorted(positions), body["pages"], elapsed < 2.0) == (
        True,
        [],
        True,
    )


def test_returns_jpeg_pages_under_the_cap_for_a_scan(client: TestClient) -> None:
    response = post_file(client, scan_pdf(4))

    body = response.json()
    assert (response.status_code, body["kind"], body["text"], body["pageCount"]) == (
        200,
        "scan",
        "",
        4,
    )
    assert [sorted(page) for page in body["pages"]] == [
        ["bytes", "index", "jpegBase64"]
    ] * 3
    for page in body["pages"]:
        assert len(base64.b64decode(page["jpegBase64"])) == page["bytes"]
        assert page["bytes"] <= MAX_JPEG_BYTES


@pytest.mark.parametrize(
    "case",
    [
        (encrypted_pdf(user_password="user-secret"), 422, "encrypted_pdf"),
        (b"%PDF-1.7\n" + b"Jane Doe junk", 422, "unreadable_file"),
        (oversized_pdf(), 413, "file_too_large"),
        (text_pdf([["Overflow page with enough text"]] * 21), 413, "file_too_large"),
        (b"GIF89a\x01\x00\x01\x00Jane Doe", 415, "unsupported_type"),
        (zip_without_document(), 415, "unsupported_type"),
        (corrupt_deflate_docx(), 422, "unreadable_file"),
        (unsupported_method_docx(), 422, "unreadable_file"),
    ],
    ids=[
        "encrypted",
        "corrupt",
        "oversized",
        "over-twenty-pages",
        "gif",
        "plain-zip",
        "corrupt-deflate-docx",
        "unsupported-method-docx",
    ],
)
def test_answers_an_error_with_the_request_id(
    client: TestClient, case: tuple[bytes, int, str]
) -> None:
    data, status, error_type = case
    response = post_file(client, data)

    body = response.json()
    assert (
        response.status_code,
        body["type"],
        body["status"],
        body["requestId"],
        response.headers["x-request-id"],
    ) == (status, error_type, status, REQUEST_ID, REQUEST_ID)
    assert "Jane Doe" not in response.text


def test_refuses_a_declared_oversize_body_before_parsing_it(client: TestClient) -> None:
    response = client.post(
        EXTRACT_PATH,
        content=bytes(11 * 1024 * 1024),
        headers={
            "content-type": "multipart/form-data; boundary=unparsed",
            "x-request-id": REQUEST_ID,
        },
    )

    assert (response.status_code, response.json()["type"]) == (413, "file_too_large")


def test_answers_422_with_the_path_when_the_file_is_missing(client: TestClient) -> None:
    response = client.post(
        EXTRACT_PATH, data={"note": "no file"}, headers={"x-request-id": REQUEST_ID}
    )

    body = response.json()
    assert (
        response.status_code,
        body["type"],
        [error["path"] for error in body["errors"]],
        body["requestId"],
    ) == (422, "validation_error", ["file"], REQUEST_ID)


def test_logs_the_shape_of_the_document_but_not_its_text(client: TestClient) -> None:
    lines: list[str] = []
    sink = logger.add(lines.append, serialize=True)
    try:
        post_file(client, two_page_pdf())
    finally:
        logger.remove(sink)

    records = [json.loads(line)["record"] for line in lines]
    extracted = [
        record for record in records if record["message"] == "document extracted"
    ]
    extra = extracted[0]["extra"]
    assert (sorted(extra), extra["fileType"], extra["kind"], extra["pageCount"]) == (
        ["durationMs", "fileType", "kind", "pageCount", "requestId", "sizeBytes"],
        "pdf",
        "text",
        2,
    )
    assert extra["sizeBytes"] == len(two_page_pdf())
    assert not [line for line in lines if "Senior Python developer" in line]
