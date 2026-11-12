from collections.abc import Callable

from app.contracts.document_extraction import DocumentExtraction
from app.extract.detect import FileType, detect_type
from app.extract.docx import extract_docx
from app.extract.image import extract_image
from app.extract.pdf import extract_pdf

EXTRACTORS: dict[FileType, Callable[[bytes], DocumentExtraction]] = {
    "pdf": extract_pdf,
    "docx": extract_docx,
    "jpeg": extract_image,
    "png": extract_image,
}


def extract_document(data: bytes) -> tuple[FileType, DocumentExtraction]:
    file_type = detect_type(data)
    return file_type, EXTRACTORS[file_type](data)
