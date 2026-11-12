from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException

from app.core.request_id import request_id_of

type ErrorType = Literal[
    "bad_request",
    "not_found",
    "method_not_allowed",
    "file_too_large",
    "unsupported_type",
    "encrypted_pdf",
    "unreadable_file",
    "validation_error",
    "internal_error",
]

PROBLEMS: dict[ErrorType, tuple[int, str]] = {
    "bad_request": (400, "Bad request"),
    "not_found": (404, "Not found"),
    "method_not_allowed": (405, "Method not allowed"),
    "file_too_large": (413, "File too large"),
    "unsupported_type": (415, "Unsupported file type"),
    "encrypted_pdf": (422, "Encrypted PDF"),
    "unreadable_file": (422, "Unreadable file"),
    "validation_error": (422, "Invalid request"),
    "internal_error": (500, "Internal error"),
}

HTTP_STATUS_TYPES: dict[int, ErrorType] = {
    400: "bad_request",
    404: "not_found",
    405: "method_not_allowed",
    413: "file_too_large",
}


class DocumentError(Exception):
    def __init__(
        self,
        error_type: ErrorType,
        *,
        detail: str | None = None,
        errors: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(error_type)
        self.type = error_type
        self.status, self.title = PROBLEMS[error_type]
        self.detail = detail
        self.errors = errors


def from_validation(error: RequestValidationError) -> DocumentError:
    errors = [
        {
            "path": ".".join(str(part) for part in item["loc"] if part != "body"),
            "message": str(item["msg"]),
        }
        for item in error.errors()
    ]
    return DocumentError("validation_error", errors=errors)


def as_document_error(error: Exception) -> DocumentError:
    if isinstance(error, DocumentError):
        return error
    if isinstance(error, RequestValidationError):
        return from_validation(error)
    if isinstance(error, HTTPException):
        return DocumentError(HTTP_STATUS_TYPES.get(error.status_code, "internal_error"))
    logger.error("unhandled error", error=type(error).__name__)
    return DocumentError("internal_error")


def problem_body(error: DocumentError, request_id: str) -> dict[str, object]:
    optional = {"detail": error.detail, "errors": error.errors}
    return {
        "type": error.type,
        "title": error.title,
        "status": error.status,
        **{name: value for name, value in optional.items() if value is not None},
        "requestId": request_id,
    }


async def document_error_handler(request: Request, error: Exception) -> JSONResponse:
    problem = as_document_error(error)
    request_id = request_id_of(request)
    logger.info(
        "request failed", status=problem.status, type=problem.type, requestId=request_id
    )
    return JSONResponse(problem_body(problem, request_id), status_code=problem.status)


def install_error_handlers(app: FastAPI) -> None:
    for error_class in (
        DocumentError,
        RequestValidationError,
        HTTPException,
        Exception,
    ):
        app.add_exception_handler(error_class, document_error_handler)
