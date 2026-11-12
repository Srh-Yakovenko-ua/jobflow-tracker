from fastapi import FastAPI

from app.api.routes import extract, health
from app.core.config import Settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.request_id import echo_request_id


def create_app(settings: Settings) -> FastAPI:
    configure_logging(settings.log_level)
    app = FastAPI(
        title="JobFlow Documents", docs_url=None, redoc_url=None, openapi_url=None
    )
    install_error_handlers(app)
    app.middleware("http")(echo_request_id)
    app.include_router(health.router)
    app.include_router(extract.router)
    return app
