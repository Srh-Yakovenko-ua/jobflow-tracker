from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.factory import create_app
from tests.factories import REQUIRED_ENV, serving, settings_for


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (*REQUIRED_ENV, "LOG_LEVEL"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def client() -> Iterator[TestClient]:
    with serving(create_app(settings_for())) as client:
        yield client
