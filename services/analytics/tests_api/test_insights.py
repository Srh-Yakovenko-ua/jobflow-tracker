import pytest

from app.core.config import Settings
from app.factory import create_app
from tests.api_client import analytics_body
from tests.routes.test_insights import INSIGHTS_PATH
from tests_api.conftest import OwnedSearch

pytestmark = pytest.mark.enable_socket


def test_says_nothing_for_an_owned_search_with_one_application(
    settings: Settings, owned: OwnedSearch
) -> None:
    body = analytics_body(
        create_app(settings),
        token=owned.token,
        query=(INSIGHTS_PATH, {"searchId": owned.search_id}),
    )

    assert body == {"insights": []}
