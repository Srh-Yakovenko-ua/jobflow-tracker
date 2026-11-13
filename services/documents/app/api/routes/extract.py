import threading
import time
from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import APIRouter, Request, Response, UploadFile
from fastapi.routing import APIRoute
from loguru import logger

from app.contracts.document_extraction import DocumentExtraction
from app.core.errors import DocumentError
from app.core.limits import LIMITS
from app.core.request_id import request_id_of
from app.extract.document import extract_document

MULTIPART_OVERHEAD_BYTES = 64 * 1024
EXTRACTION_LOCK = threading.Lock()

type RouteHandler = Callable[[Request], Coroutine[Any, Any, Response]]


def too_large() -> DocumentError:
    return DocumentError(
        "file_too_large", detail=f"The file is larger than {LIMITS.max_bytes} bytes"
    )


def declared_too_large(content_length: str | None) -> bool:
    declared = int(content_length) if content_length and content_length.isdigit() else 0
    return declared > LIMITS.max_bytes + MULTIPART_OVERHEAD_BYTES


class SizeCappedRoute(APIRoute):
    def get_route_handler(self) -> RouteHandler:
        handler = super().get_route_handler()

        async def capped(request: Request) -> Response:
            if declared_too_large(request.headers.get("content-length")):
                raise too_large()
            return await handler(request)

        return capped


router = APIRouter(route_class=SizeCappedRoute)


@router.post("/documents/extract", response_model=DocumentExtraction)
def extract(file: UploadFile, request: Request) -> DocumentExtraction:
    started = time.perf_counter()
    data = file.file.read(LIMITS.max_bytes + 1)
    if len(data) > LIMITS.max_bytes:
        raise too_large()
    with EXTRACTION_LOCK:
        file_type, extraction = extract_document(data)
    logger.info(
        "document extracted",
        sizeBytes=len(data),
        fileType=file_type,
        pageCount=extraction.page_count,
        kind=extraction.kind.value,
        durationMs=round((time.perf_counter() - started) * 1000),
        requestId=request_id_of(request),
    )
    return extraction
