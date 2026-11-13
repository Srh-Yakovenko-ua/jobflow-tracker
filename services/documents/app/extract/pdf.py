import re

import pypdfium2 as pdfium
from pypdfium2 import raw

from app.contracts.document_extraction import DocumentExtraction, Kind, Page
from app.core.errors import DocumentError
from app.core.limits import LIMITS
from app.extract.image import MAX_LONG_SIDE, MAX_PIXELS, to_jpeg_page

SCAN_DPI = 150
POINTS_PER_INCH = 72
MIN_CHARS_PER_PAGE = 50
ENCRYPTED_CODES = {raw.FPDF_ERR_PASSWORD, raw.FPDF_ERR_SECURITY}
NAME_ESCAPE = re.compile(rb"#([0-9A-Fa-f]{2})")
PDF_SPACE = rb"(?:[\x00\t\n\x0c\r \x80\xff]|%[^\r\n]*+)"
REGULAR = rb"[^\x00\t\n\x0c\r \x80\xff/<>\[\](){}%]"
NUMERIC = rb"[0-9+\-.]"
SIZE_ENTRY = re.compile(
    rb"/(Width|Height)(?!%s)%s*+(%s*+(?:%s++%s++%s++R(?!%s))?)"
    % (REGULAR, PDF_SPACE, REGULAR, PDF_SPACE, NUMERIC, PDF_SPACE, REGULAR)
)


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


def too_many_pixels() -> DocumentError:
    return DocumentError(
        "unreadable_file", detail="The page images have too many pixels"
    )


def check_image_pixels(page: pdfium.PdfPage) -> None:
    images = page.get_objects(filter=[raw.FPDF_PAGEOBJ_IMAGE])
    sizes = (image.get_px_size() for image in images)
    if sum(width * height for width, height in sizes) > MAX_PIXELS:
        raise too_many_pixels()


def declared_sizes(data: bytes) -> dict[bytes, list[int]]:
    names = NAME_ESCAPE.sub(lambda escape: bytes.fromhex(escape[1].decode()), data)
    sizes: dict[bytes, list[int]] = {b"Width": [], b"Height": []}
    for key, value in SIZE_ENTRY.findall(names):
        if not value.isdigit():
            raise too_many_pixels()
        sizes[key].append(int(value))
    return sizes


def check_stream_image_pixels(data: bytes) -> None:
    sizes = declared_sizes(data)
    widths, heights = sizes[b"Width"], sizes[b"Height"]
    bound = min(
        sum(widths) * max(heights, default=0), sum(heights) * max(widths, default=0)
    )
    if bound > MAX_PIXELS:
        raise too_many_pixels()


def render_page(page: pdfium.PdfPage, index: int) -> Page:
    check_image_pixels(page)
    scale = min(SCAN_DPI / POINTS_PER_INCH, MAX_LONG_SIDE / max(page.get_size()))
    bitmap = page.render(scale=scale, draw_annots=False, may_draw_forms=False)
    return to_jpeg_page(bitmap.to_pil(), index)


def read_pdf(document: pdfium.PdfDocument, data: bytes) -> DocumentExtraction:
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
    check_stream_image_pixels(data)
    pages = [
        render_page(document[index], index)
        for index in range(min(LIMITS.scan_pages, page_count))
    ]
    return DocumentExtraction(
        kind=Kind.scan, text="", pages=pages, page_count=page_count
    )


def extract_pdf(data: bytes) -> DocumentExtraction:
    document = open_pdf(data)
    try:
        return read_pdf(document, data)
    except pdfium.PdfiumError as error:
        raise DocumentError("unreadable_file") from error
    finally:
        document.close()
