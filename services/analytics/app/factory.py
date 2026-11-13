from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import partial

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    forecast,
    funnel,
    health,
    insights,
    reasons,
    resume_ab,
    sankey,
    sources,
    timings,
)
from app.core.auth import key_source_for
from app.core.config import Settings
from app.core.enums import check_stages, load_domain_enums
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.request_id import REQUEST_ID_HEADER, RequestIdMiddleware
from app.core.resources import create_engine, create_redis
from app.repositories.health import select_one
from app.services.readiness import ReadinessService


def create_app(settings: Settings) -> FastAPI:
    check_stages(load_domain_enums())
    configure_logging(settings.log_level)
    engine = create_engine(settings)
    redis = create_redis(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()
        await redis.aclose()

    app = FastAPI(title="JobFlow Analytics", redoc_url=None, lifespan=lifespan)
    app.state.engine = engine
    app.state.redis = redis
    app.state.readiness = ReadinessService(
        {"postgres": partial(select_one, engine), "redis": redis.ping}
    )
    app.state.key_source = key_source_for(settings)
    install_error_handlers(app)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.web_origin],
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Authorization"],
        expose_headers=[REQUEST_ID_HEADER, "Retry-After"],
    )
    app.include_router(health.router)
    app.include_router(funnel.router)
    app.include_router(sankey.router)
    app.include_router(reasons.router)
    app.include_router(sources.router)
    app.include_router(timings.router)
    app.include_router(resume_ab.router)
    app.include_router(forecast.router)
    app.include_router(insights.router)
    return app
