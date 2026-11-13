from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import pytest
from redis import Redis

from app.core.config import Settings
from tests.api_client import api_call, register, rejected_at_screening


@pytest.fixture(scope="module")
def settings() -> Settings:
    return Settings()


@pytest.fixture
def cache(settings: Settings) -> Iterator[Redis]:
    client = Redis.from_url(settings.redis_url)
    yield client
    client.close()


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


def active_search(settings: Settings, *, token: str) -> Any:
    searches = api_call(settings, token=token, request=("GET", "/searches", None))
    return next(item for item in searches["items"] if item["status"] == "active")


def owned_search(settings: Settings, registered: Any) -> OwnedSearch:
    token = registered["accessToken"]
    active = active_search(settings, token=token)
    rejected_at_screening(settings, token=token, reason="unspecified")
    return OwnedSearch(
        token=token, search_id=str(active["id"]), user_id=registered["user"]["id"]
    )


def finished_search(settings: Settings) -> OwnedSearch:
    return finish_search(settings, owned_search(settings, register(settings)))


def finish_search(settings: Settings, finished: OwnedSearch) -> OwnedSearch:
    finish = {
        "searchId": finished.search_id,
        "outcome": "paused",
        "openApplications": "move",
    }
    request = ("POST", "/searches/current/finish", finish)
    api_call(settings, token=finished.token, request=request)
    return finished
