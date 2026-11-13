from dataclasses import dataclass
from typing import Any

import pytest

from app.core.config import Settings
from tests.api_client import api_call, register, rejected_at_screening


@pytest.fixture(scope="module")
def settings() -> Settings:
    return Settings()


@pytest.fixture(scope="module")
def registered(settings: Settings) -> Any:
    return register(settings)


@dataclass(frozen=True)
class OwnedSearch:
    token: str
    search_id: str
    user_id: str


@pytest.fixture(scope="module")
def owned(settings: Settings, registered: Any) -> OwnedSearch:
    return owned_search(settings, registered)


def owned_search(settings: Settings, registered: Any) -> OwnedSearch:
    token = registered["accessToken"]
    searches = api_call(settings, token=token, request=("GET", "/searches", None))
    active = next(item for item in searches["items"] if item["status"] == "active")
    rejected_at_screening(settings, token=token, reason="unspecified")
    return OwnedSearch(
        token=token, search_id=str(active["id"]), user_id=registered["user"]["id"]
    )
