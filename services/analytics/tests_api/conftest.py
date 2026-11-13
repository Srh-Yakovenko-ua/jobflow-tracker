from typing import Any

import pytest

from app.core.config import Settings
from tests.api_client import register


@pytest.fixture(scope="module")
def settings() -> Settings:
    return Settings()


@pytest.fixture(scope="module")
def registered(settings: Settings) -> Any:
    return register(settings)
