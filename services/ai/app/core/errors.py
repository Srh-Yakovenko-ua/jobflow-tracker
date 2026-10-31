from collections.abc import Sequence
from dataclasses import asdict, dataclass
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException

from app.core.request_id import request_id_of

ERRORS: dict[int, tuple[str, str]] = {
    401: ("unauthorized", "Unauthorized"),
    403: ("forbidden", "Forbidden"),
    404: ("not_found", "Not found"),
    422: ("validation_error", "Invalid request"),
    429: ("rate_limited", "Too many requests"),
    500: ("internal_error", "Internal error"),
    501: ("not_implemented", "Not implemented"),
    502: ("ai_provider_error", "AI provider error"),
    503: ("not_ready", "Service not ready"),
    504: ("ai_timeout", "AI timeout"),
}


@dataclass(frozen=True)
class FieldError:
    path: str
    message: str


class AppError(Exception):
    def __init__(
        self,
        status: int,
        *,
        detail: str | None = None,
        errors: list[FieldError] | None = None,
    ) -> None:
        super().__init__(f"HTTP {status}")
        self.status = status
        self.detail = detail
        self.errors = errors


def timeout_error(seconds: float) -> AppError:
    return AppError(504, detail=f"The model did not answer within {seconds:g} seconds")


def field_errors(errors: Sequence[Any]) -> list[FieldError]:
    return [
        FieldError(
            path=".".join(str(part) for part in error["loc"] if part != "body"),
            message=error["msg"],
        )
        for error in errors
    ]


def problem(request: Request, error: AppError) -> JSONResponse:
    error_type, title = ERRORS.get(
        error.status, ("http_error", HTTPStatus(error.status).phrase)
    )
    body: dict[str, object] = {
        "type": error_type,
        "title": title,
        "status": error.status,
    }
    if error.detail is not None:
        body["detail"] = error.detail
    if error.errors is not None:
        body["errors"] = [asdict(field) for field in error.errors]
    body["requestId"] = request_id_of(request)
    logger.info(
        "request failed",
        status=error.status,
        type=error_type,
        requestId=body["requestId"],
    )
    headers = {"www-authenticate": "Bearer"} if error.status == 401 else None
    return JSONResponse(body, status_code=error.status, headers=headers)


def as_app_error(error: Exception) -> AppError:
    if isinstance(error, AppError):
        return error
    if isinstance(error, RequestValidationError):
        return AppError(422, errors=field_errors(error.errors()))
    if isinstance(error, HTTPException):
        return AppError(error.status_code)
    logger.error("unhandled error", error=type(error).__name__)
    return AppError(500)


async def app_error_handler(request: Request, error: Exception) -> JSONResponse:
    return problem(request, as_app_error(error))


def install_error_handlers(app: FastAPI) -> None:
    for error_class in (AppError, RequestValidationError, HTTPException, Exception):
        app.add_exception_handler(error_class, app_error_handler)
