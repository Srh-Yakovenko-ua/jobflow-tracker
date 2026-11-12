import socket
from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings

REQUIRED_ENV = {
    "DATABASE_URL_ANALYTICS": "postgresql://jobflow_analytics:test@db:5432/jobflow",
    "REDIS_URL": "redis://cache:6379",
}

UNUSED_PORT = 9


def settings_for(
    *, postgres_port: int = UNUSED_PORT, redis_port: int = UNUSED_PORT
) -> Settings:
    return Settings(
        _env_file=None,
        database_url_analytics=f"postgresql://jobflow_analytics:test@127.0.0.1:{postgres_port}/jobflow",
        redis_url=f"redis://127.0.0.1:{redis_port}",
    )


@contextmanager
def serving(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def closed_port() -> int:
    with socket.create_server(("127.0.0.1", 0)) as listener:
        port: int = listener.getsockname()[1]
    return port


@contextmanager
def silent_listener() -> Iterator[int]:
    with socket.create_server(("127.0.0.1", 0), backlog=8) as listener:
        yield listener.getsockname()[1]
