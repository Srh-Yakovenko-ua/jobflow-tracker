import pytest
from redis import Redis

from app.core.config import Settings
from app.core.enums import load_domain_enums
from app.factory import create_app
from tests.api_client import (
    WARM_CALLS,
    analytics_body,
    application_through,
    register,
    warm_calls,
)
from tests.routes.test_funnel import FUNNEL_PATH, SEARCH_PATHS
from tests.routes.test_reasons import SUMMARY_PATH
from tests_api.conftest import OwnedSearch, active_search

pytestmark = pytest.mark.enable_socket

DASHBOARD_LIMIT_SECONDS = 0.05
DASHBOARD_BLOCKS = [path for path, _ in SEARCH_PATHS if path != SUMMARY_PATH]


@pytest.mark.parametrize("path", DASHBOARD_BLOCKS)
def test_answers_each_dashboard_block_within_50_ms_once_cached(
    settings: Settings, owned: OwnedSearch, *, path: str
) -> None:
    statuses, median = warm_calls(
        create_app(settings),
        token=owned.token,
        query=(path, {"searchId": owned.search_id}),
    )

    assert statuses == [200] * WARM_CALLS
    assert median < DASHBOARD_LIMIT_SECONDS


def reached_screening(settings: Settings, *, token: str, search_id: str) -> int:
    body = analytics_body(
        create_app(settings), token=token, query=(FUNNEL_PATH, {"searchId": search_id})
    )
    screening: int = body["stages"][1]["reached"]
    return screening


def test_shows_a_moved_card_once_the_worker_bumps_the_users_version(
    settings: Settings, cache: Redis
) -> None:
    registered = register(settings)
    token = registered["accessToken"]
    application_through(settings, token=token, path=["screening"])
    search_id = str(active_search(settings, token=token)["id"])
    before = reached_screening(settings, token=token, search_id=search_id)
    application_through(settings, token=token, path=["screening"])
    still_cached = reached_screening(settings, token=token, search_id=search_id)
    version_key = load_domain_enums().analytics_cache.version_key
    cache.incr(version_key.format(userId=registered["user"]["id"]))

    after = reached_screening(settings, token=token, search_id=search_id)

    assert (before, still_cached, after) == (1, 1, 2)
