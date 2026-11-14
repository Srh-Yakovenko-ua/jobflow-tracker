import pypdfium2 as pdfium
from pypdfium2 import raw

from app.contracts.document_extraction import DocumentExtraction, Kind
from app.core.errors import DocumentError
from app.core.limits import LIMITS
from app.extract.render_sandbox import render_scan

MIN_CHARS_PER_PAGE = 50
ENCRYPTED_CODES = {raw.FPDF_ERR_PASSWORD, raw.FPDF_ERR_SECURITY}


def open_pdf(data: bytes) -> pdfium.PdfDocument:
    try:
        return pdfium.PdfDocument(data)
    except pdfium.PdfiumError as error:
        encrypted = error.err_code in ENCRYPTED_CODES
        raise DocumentError(
            "encrypted_pdf" if encrypted else "unreadable_file"
        ) from error


def page_text(page: pdfium.PdfPage) -> str:
    return page.get_textpage().get_text_bounded().replace("\r\n", "\n").strip()


def read_pdf(document: pdfium.PdfDocument, *, data: bytes) -> DocumentExtraction:
    page_count = len(document)
    if page_count > LIMITS.max_pages:
        raise DocumentError(
            "file_too_large",
            detail=f"The PDF has more than {LIMITS.max_pages} pages",
        )
    texts = [page_text(document[index]) for index in range(page_count)]
    if sum(map(len, texts)) >= MIN_CHARS_PER_PAGE * page_count:
        return DocumentExtraction(
            kind=Kind.text,
            text="\n\n".join(text for text in texts if text),
            pages=[],
            page_count=page_count,
        )
    pages = render_scan(data, count=min(LIMITS.scan_pages, page_count))
    return DocumentExtraction(
        kind=Kind.scan, text="", pages=pages, page_count=page_count
    )


def extract_pdf(data: bytes) -> DocumentExtraction:
    document = open_pdf(data)
    try:
        return read_pdf(document, data=data)
    except pdfium.PdfiumError as error:
        raise DocumentError("unreadable_file") from error
    finally:
        document.close()
