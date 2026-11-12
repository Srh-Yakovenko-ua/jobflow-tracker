import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.factory import create_app


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LOG_LEVEL", raising=False)


@pytest.fixture
def client() -> TestClient:
    return TestClient(
        create_app(Settings(_env_file=None)), raise_server_exceptions=False
    )
