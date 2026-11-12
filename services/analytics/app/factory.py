from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import partial

from fastapi import FastAPI

from app.api.routes import health
from app.core.config import Settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.request_id import RequestIdMiddleware
from app.core.resources import create_engine, create_redis
from app.repositories.health import select_one
from app.services.readiness import ReadinessService


def create_app(settings: Settings) -> FastAPI:
    configure_logging(settings.log_level)
    engine = create_engine(settings)
    redis = create_redis(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()
        await redis.aclose()

    app = FastAPI(title="JobFlow Analytics", redoc_url=None, lifespan=lifespan)
    app.state.readiness = ReadinessService(
        {"postgres": partial(select_one, engine), "redis": redis.ping}
    )
    install_error_handlers(app)
    app.add_middleware(RequestIdMiddleware)
    app.include_router(health.router)
    return app
