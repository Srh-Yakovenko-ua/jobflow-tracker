import pytest

from app.core.config import Settings
from app.factory import create_app
from tests.api_client import analytics_body
from tests.routes.test_forecast import FORECAST_PATH
from tests_api.conftest import OwnedSearch

pytestmark = pytest.mark.enable_socket


def test_answers_insufficient_data_for_an_owned_search_under_fifteen_applications(
    settings: Settings, owned: OwnedSearch
) -> None:
    body = analytics_body(
        create_app(settings),
        token=owned.token,
        query=(FORECAST_PATH, {"searchId": owned.search_id}),
    )

    assert body == {
        "status": "insufficient_data",
        "have": 1,
        "need": 14,
        "message": "Ще 14 відгуків до першого висновку",
    }
