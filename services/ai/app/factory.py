from fastapi import FastAPI

from app.api.routes import complete, embed, health
from app.core.auth import key_source_for
from app.core.config import Settings
from app.core.errors import install_error_handlers
from app.core.limiter import RateLimiter
from app.core.logging import configure_logging
from app.core.request_id import assign_request_id
from app.core.structured import Runtime
from app.prompts import check_prompt_versions, load_prompt_versions
from app.providers import provider_for


def create_app(settings: Settings) -> FastAPI:
    check_prompt_versions(load_prompt_versions())
    configure_logging(settings.log_level)
    app = FastAPI(title="JobFlow AI", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.runtime = Runtime(
        provider=provider_for(settings),
        limiter=RateLimiter(settings.ai_rate_limit_per_minute),
        timeout_seconds=settings.ai_timeout_seconds,
    )
    app.state.key_source = key_source_for(settings)
    install_error_handlers(app)
    app.middleware("http")(assign_request_id)
    for router in (health.router, complete.router, embed.router):
        app.include_router(router)
    return app
