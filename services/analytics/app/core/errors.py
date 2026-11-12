from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException

from app.core.request_id import request_id_from

PROBLEM_TYPES: dict[int, tuple[str, str]] = {
    404: ("not_found", "Not found"),
    405: ("method_not_allowed", "Method not allowed"),
    422: ("validation_error", "Invalid request"),
    500: ("internal_error", "Internal error"),
    503: ("not_ready", "Service not ready"),
}

INTERNAL_STATUS = 500

type FieldErrors = list[dict[str, str]]


class ServiceError(Exception):
    def __init__(
        self,
        status: int,
        *,
        detail: str | None = None,
        errors: FieldErrors | None = None,
    ) -> None:
        super().__init__(status)
        self.status = status if status in PROBLEM_TYPES else INTERNAL_STATUS
        self.detail = detail
        self.errors = errors


def field_errors(error: RequestValidationError) -> FieldErrors:
    return [
        {
            "path": ".".join(str(part) for part in issue["loc"]),
            "message": str(issue["msg"]),
        }
        for issue in error.errors()
    ]


def to_service_error(error: Exception) -> ServiceError:
    match error:
        case ServiceError():
            return error
        case RequestValidationError():
            return ServiceError(422, errors=field_errors(error))
        case HTTPException():
            return ServiceError(error.status_code)
    logger.error("unhandled error", error=type(error).__name__)
    return ServiceError(INTERNAL_STATUS)


def problem(error: ServiceError, request_id: str) -> dict[str, object]:
    error_type, title = PROBLEM_TYPES[error.status]
    extras = {"detail": error.detail, "errors": error.errors}
    return {
        "type": error_type,
        "title": title,
        "status": error.status,
        **{key: value for key, value in extras.items() if value is not None},
        "requestId": request_id,
    }


async def respond_with_problem(request: Request, error: Exception) -> JSONResponse:
    service_error = to_service_error(error)
    request_id = request_id_from(request)
    logger.info("request failed", status=service_error.status, requestId=request_id)
    return JSONResponse(
        problem(service_error, request_id), status_code=service_error.status
    )


def install_error_handlers(app: FastAPI) -> None:
    for error_class in (ServiceError, RequestValidationError, HTTPException, Exception):
        app.add_exception_handler(error_class, respond_with_problem)
