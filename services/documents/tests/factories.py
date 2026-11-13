import random
import struct
import zipfile
import zlib
from io import BytesIO

from docx import Document
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from PIL import ExifTags, Image
from pypdf import PdfWriter

MAX_BYTES = 10 * 1024 * 1024
MAX_JPEG_BYTES = 180 * 1024
DOCUMENT_XML = "word/document.xml"
MAX_XML_BYTES = 4 * 1024 * 1024
RENAMED_DOCUMENT = "word/main.dat"
UPPER_CASE_OVERRIDE = (
    f'PartName="/{RENAMED_DOCUMENT}"'.encode(),
    f'PartName="/{RENAMED_DOCUMENT.upper()}"'.encode(),
)
UPPER_CASE_DEFAULT = (
    f'Override PartName="/{RENAMED_DOCUMENT}"'.encode(),
    b'Default Extension="DAT"',
)

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


def stream_object(data: bytes, entries: bytes = b"") -> bytes:
    return b"<< %s/Length %d >>\nstream\n%s\nendstream" % (entries, len(data), data)


def content_stream(lines: list[str]) -> bytes:
    shown = b" ".join(b"(%s) Tj 0 -18 Td" % line.encode("latin-1") for line in lines)
    return stream_object(b"BT /F1 14 Tf 72 760 Td %s ET" % shown)


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


def pdf_bytes(bodies: list[bytes]) -> bytes:
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


def text_pdf(pages: list[list[str]]) -> bytes:
    kids = b" ".join(b"%d 0 R" % (4 + 2 * index) for index in range(len(pages)))
    return pdf_bytes(
        [
            b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, len(pages)),
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            *page_objects(pages),
        ]
    )


DRAW_IM0 = b"q 612 0 0 792 0 0 cm /Im0 Do Q"
DECLARED_ONLY = b"\x00"


def im0_at(number: int) -> bytes:
    return b"/Resources << /XObject << /Im0 %d 0 R >> >> " % number


def image_entries(width: bytes, height: bytes) -> bytes:
    return (
        b"/Type /XObject /Subtype /Image /Width %s /Height %s /ColorSpace /DeviceGray "
        b"/BitsPerComponent 8 " % (width, height)
    )


def declared_image(side: int, entries: bytes = b"") -> bytes:
    size = b"%d" % side
    return stream_object(DECLARED_ONLY, image_entries(size, size) + entries)


def single_page_pdf(*, page: bytes, content: bytes, objects: list[bytes]) -> bytes:
    return pdf_bytes(
        [
            b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            (
                b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                b"%s/Contents 4 0 R >>" % page
            ),
            stream_object(content),
            *objects,
        ]
    )


def image_pdf(*, width: int, height: int) -> bytes:
    entries = image_entries(b"%d" % width, b"%d" % height) + b"/Filter /FlateDecode "
    return single_page_pdf(
        page=im0_at(5),
        content=DRAW_IM0,
        objects=[stream_object(zlib.compress(bytes(width * height)), entries)],
    )


def masked_pdf(
    *, mask_size: bytes = b"/Width 8000 /Height 8000", sizes: tuple[bytes, ...] = ()
) -> bytes:
    mask = declared_image(8000).replace(b"/Width 8000 /Height 8000", mask_size)
    return single_page_pdf(
        page=im0_at(5),
        content=DRAW_IM0,
        objects=[declared_image(1, b"/SMask 6 0 R "), mask, *sizes],
    )


def annotated_pdf() -> bytes:
    form = b"/Type /XObject /Subtype /Form /BBox [0 0 612 792] " + im0_at(7)
    return single_page_pdf(
        page=b"/Annots [5 0 R] ",
        content=b"",
        objects=[
            b"<< /Type /Annot /Subtype /Square /Rect [0 0 612 792] /AP << /N 6 0 R >> >>",
            stream_object(DRAW_IM0, form),
            declared_image(8000),
        ],
    )


def indirect_width_pdf() -> bytes:
    return single_page_pdf(
        page=im0_at(5),
        content=DRAW_IM0,
        objects=[stream_object(DECLARED_ONLY, image_entries(b"6 0 R", b"1")), b"1"],
    )


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


def control(content: str) -> str:
    return f"<w:sdt {nsdecls('w')}><w:sdtContent>{content}</w:sdtContent></w:sdt>"


def template_docx() -> bytes:
    document = Document()
    document.add_paragraph("Jane Doe")._p.addnext(
        parse_xml(control("<w:p><w:r><w:t>Senior Python developer</w:t></w:r></w:p>"))
    )
    document.add_paragraph("City: ")._p.append(
        parse_xml(control("<w:r><w:t>Kyiv</w:t></w:r>"))
    )
    table = document.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Acme Corp"
    table.cell(0, 1).text = "Stack"
    inner = table.cell(0, 1).add_table(rows=1, cols=2)
    inner.cell(0, 0).text = "FastAPI"
    inner.cell(0, 1).text = "pandas"
    document.add_paragraph("References on request")
    buffer = BytesIO()
    document.save(buffer)
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
    *,
    document_xml: bytes | None = None,
    document_name: str = DOCUMENT_XML,
    document_method: int = zipfile.ZIP_DEFLATED,
    document_flags: int = 0,
    types_edit: tuple[bytes, bytes] = (b"", b""),
) -> bytes:
    buffer = BytesIO()
    with (
        zipfile.ZipFile(BytesIO(resume_docx())) as source,
        zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as target,
    ):
        for entry in source.infolist():
            body = (
                source.read(entry)
                .replace(DOCUMENT_XML.encode(), document_name.encode())
                .replace(*types_edit)
            )
            if entry.filename == DOCUMENT_XML:
                target.writestr(document_name, document_xml or body)
            if entry.filename != document_name:
                target.writestr(entry.filename, body)
        document = target.getinfo(document_name)
        document.compress_type = document_method
        document.flag_bits |= document_flags
    return buffer.getvalue()


def unsupported_method_docx() -> bytes:
    return rebuilt_docx(document_method=99)


def wrong_root_docx() -> bytes:
    return rebuilt_docx(document_xml=b'<?xml version="1.0"?><root/>')


def encrypted_entry_docx() -> bytes:
    return rebuilt_docx(document_flags=0x1)


def body_xml(blocks: bytes) -> bytes:
    return b"<w:document %s><w:body>%s</w:body></w:document>" % (
        nsdecls("w").encode(),
        blocks,
    )


def bloated_xml_docx(
    *, document_name: str = DOCUMENT_XML, types_edit: tuple[bytes, bytes] = (b"", b"")
) -> bytes:
    paragraphs = b"<w:p/>" * (MAX_XML_BYTES // len(b"<w:p/>") + 1)
    return rebuilt_docx(
        document_xml=body_xml(paragraphs),
        document_name=document_name,
        types_edit=types_edit,
    )


def sibling_controls_docx(count: int) -> bytes:
    return rebuilt_docx(document_xml=body_xml(b"<w:sdt/>" * count))


def png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def noise_png() -> bytes:
    return png_bytes(noise_image((1800, 1200), 7))


def transparent_png() -> bytes:
    return png_bytes(Image.new("RGBA", (40, 30), (0, 0, 0, 0)))


def white_png() -> bytes:
    return png_bytes(Image.new("RGB", (6000, 4000), "white"))


def pixel_bomb_png() -> bytes:
    return png_bytes(Image.new("1", (8000, 7000)))


def phone_jpeg() -> bytes:
    exif = Image.Exif()
    exif[ExifTags.Base.Orientation] = 6
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    gps[ExifTags.GPS.GPSLatitudeRef] = "N"
    gps[ExifTags.GPS.GPSLatitude] = (50.0, 27.0, 0.0)
    buffer = BytesIO()
    Image.new("RGB", (800, 600), "white").save(
        buffer, format="JPEG", exif=exif, comment=b"Jane Doe 50.45N"
    )
    return buffer.getvalue()


def oversized_pdf() -> bytes:
    header = b"%PDF-1.7\n"
    return header + bytes(MAX_BYTES + 1 - len(header))
