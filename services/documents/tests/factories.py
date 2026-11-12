import random
import struct
import zipfile
from io import BytesIO

from docx import Document
from PIL import ExifTags, Image
from pypdf import PdfWriter

MAX_BYTES = 10 * 1024 * 1024
MAX_JPEG_BYTES = 180 * 1024
DOCUMENT_XML = "word/document.xml"

FIRST_PAGE = [
    "Jane Doe",
    "Senior Python developer",
    "Builds data services for hiring teams",
]
SECOND_PAGE = [
    "Experience: Acme Corp 2021-2026",
    "Skills: FastAPI, pandas, SQL",
    "Languages: English C1, Ukrainian native",
]


def pdf_object(number: int, body: bytes) -> bytes:
    return b"%d 0 obj\n%s\nendobj\n" % (number, body)


def content_stream(lines: list[str]) -> bytes:
    shown = b" ".join(b"(%s) Tj 0 -18 Td" % line.encode("latin-1") for line in lines)
    stream = b"BT /F1 14 Tf 72 760 Td %s ET" % shown
    return b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)


def page_objects(pages: list[list[str]]) -> list[bytes]:
    bodies: list[bytes] = []
    for position, lines in enumerate(pages):
        content_number = 5 + 2 * position
        bodies.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>"
            % content_number
        )
        bodies.append(content_stream(lines))
    return bodies


def text_pdf(pages: list[list[str]]) -> bytes:
    kids = b" ".join(b"%d 0 R" % (4 + 2 * index) for index in range(len(pages)))
    bodies = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, len(pages)),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        *page_objects(pages),
    ]
    output = bytearray(b"%PDF-1.7\n")
    offsets = []
    for number, body in enumerate(bodies, start=1):
        offsets.append(len(output))
        output += pdf_object(number, body)
    xref_at = len(output)
    output += b"xref\n0 %d\n0000000000 65535 f \n" % (len(bodies) + 1)
    output += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    output += b"trailer\n<< /Size %d /Root 1 0 R >>\n" % (len(bodies) + 1)
    output += b"startxref\n%d\n%%%%EOF\n" % xref_at
    return bytes(output)


def two_page_pdf() -> bytes:
    return text_pdf([FIRST_PAGE, SECOND_PAGE])


def noise_image(size: tuple[int, int], seed: int) -> Image.Image:
    noise = random.Random(seed).randbytes(size[0] * size[1] * 3)
    return Image.frombytes("RGB", size, noise)


def scan_pdf(page_count: int) -> bytes:
    pages = [noise_image((1240, 1754), seed) for seed in range(page_count)]
    buffer = BytesIO()
    pages[0].save(
        buffer, format="PDF", save_all=True, append_images=pages[1:], resolution=150
    )
    return buffer.getvalue()


def encrypted_pdf(*, user_password: str) -> bytes:
    writer = PdfWriter(clone_from=BytesIO(two_page_pdf()))
    writer.encrypt(user_password=user_password, owner_password="owner-secret")
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def resume_docx(*, extra_entry_bytes: int = 0) -> bytes:
    document = Document()
    document.add_paragraph("Jane Doe")
    document.add_paragraph("")
    document.add_paragraph("Senior Python developer")
    table = document.add_table(rows=2, cols=3)
    table.cell(0, 0).merge(table.cell(0, 1)).text = "Acme Corp"
    table.cell(0, 2).text = "2021-2026"
    table.cell(1, 0).text = "FastAPI"
    table.cell(1, 2).text = "pandas"
    document.add_paragraph("References on request")
    buffer = BytesIO()
    document.save(buffer)
    if extra_entry_bytes:
        with zipfile.ZipFile(buffer, "a", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("word/media/padding.bin", bytes(extra_entry_bytes))
    return buffer.getvalue()


def empty_docx() -> bytes:
    buffer = BytesIO()
    Document().save(buffer)
    return buffer.getvalue()


def zip_without_document() -> bytes:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("notes.txt", "plain zip")
    return buffer.getvalue()


def broken_docx() -> bytes:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", "<w:document><unclosed")
    return buffer.getvalue()


def corrupt_deflate_docx() -> bytes:
    data = bytearray(resume_docx())
    entry = zipfile.ZipFile(BytesIO(bytes(data))).getinfo(DOCUMENT_XML)
    name_length, extra_length = struct.unpack_from(
        "<HH", data, entry.header_offset + 26
    )
    data[entry.header_offset + 30 + name_length + extra_length] ^= 0xFF
    return bytes(data)


def rebuilt_docx(
    *, document_xml: bytes | None = None, document_method: int = zipfile.ZIP_DEFLATED
) -> bytes:
    buffer = BytesIO()
    with (
        zipfile.ZipFile(BytesIO(resume_docx())) as source,
        zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as target,
    ):
        for entry in source.infolist():
            body = source.read(entry)
            if entry.filename == DOCUMENT_XML and document_xml is not None:
                body = document_xml
            target.writestr(entry.filename, body)
        target.getinfo(DOCUMENT_XML).compress_type = document_method
    return buffer.getvalue()


def unsupported_method_docx() -> bytes:
    return rebuilt_docx(document_method=99)


def wrong_root_docx() -> bytes:
    return rebuilt_docx(document_xml=b'<?xml version="1.0"?><root/>')


def noise_png() -> bytes:
    buffer = BytesIO()
    noise_image((1800, 1200), 7).save(buffer, format="PNG")
    return buffer.getvalue()


def transparent_png() -> bytes:
    buffer = BytesIO()
    Image.new("RGBA", (40, 30), (0, 0, 0, 0)).save(buffer, format="PNG")
    return buffer.getvalue()


def pixel_bomb_png() -> bytes:
    buffer = BytesIO()
    Image.new("1", (8000, 7000)).save(buffer, format="PNG")
    return buffer.getvalue()


def phone_jpeg() -> bytes:
    exif = Image.Exif()
    exif[ExifTags.Base.Orientation] = 6
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    gps[ExifTags.GPS.GPSLatitudeRef] = "N"
    gps[ExifTags.GPS.GPSLatitude] = (50.0, 27.0, 0.0)
    buffer = BytesIO()
    Image.new("RGB", (800, 600), "white").save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


def oversized_pdf() -> bytes:
    header = b"%PDF-1.7\n"
    return header + bytes(MAX_BYTES + 1 - len(header))
