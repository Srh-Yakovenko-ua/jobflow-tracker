from dataclasses import dataclass
from typing import Any

import httpx2
import pytest

from app.core.config import Settings
from app.factory import create_app
from tests.api_client import api_call, register
from tests.factories import bearer, problem_body, uvicorn_serving

pytestmark = pytest.mark.enable_socket

SCREENING_THEN_REJECTED = [
    {"fromStage": "applied", "toStage": "screening"},
    {"fromStage": "screening", "toStage": "rejected", "reasonCode": "unspecified"},
]


@dataclass(frozen=True)
class OwnedSearch:
    token: str
    search_id: str


@pytest.fixture(scope="module")
def owned(settings: Settings, registered: Any) -> OwnedSearch:
    token = registered["accessToken"]
    searches = api_call(settings, token=token, request=("GET", "/searches", None))
    active = next(item for item in searches["items"] if item["status"] == "active")
    created = api_call(
        settings,
        token=token,
        request=("POST", "/applications", {"company": "Acme", "position": "QA"}),
    )
    for move in SCREENING_THEN_REJECTED:
        path = f"/applications/{created['id']}/events"
        api_call(settings, token=token, request=("POST", path, move))
    return OwnedSearch(token=token, search_id=str(active["id"]))


def funnel_over_http(settings: Settings, *, token: str, search_id: str) -> Any:
    with uvicorn_serving(create_app(settings)) as base_url:
        return httpx2.get(
            f"{base_url}/analytics/funnel",
            params={"searchId": search_id},
            headers=bearer(token),
            timeout=10,
        )


def test_counts_a_rejection_after_screening_at_screening_over_http(
    settings: Settings, owned: OwnedSearch
) -> None:
    response = funnel_over_http(settings, token=owned.token, search_id=owned.search_id)

    body = response.json()
    applied, screening, *_ = body["stages"]
    assert (response.status_code, sorted(body)) == (
        200,
        ["kpis", "mostExpensive", "stages"],
    )
    assert (applied["reached"], applied["passed"]) == (1, 1)
    assert screening == {
        "stage": "screening",
        "reached": 1,
        "passed": 0,
        "conversion": {
            "status": "insufficient_data",
            "have": 1,
            "need": 4,
            "message": "Ще 4 відгуки до першого висновку",
        },
        "dropOff": {"rejected": 1, "ghosted": 0, "withdrawn": 0},
    }


def test_answers_not_found_for_another_users_search(
    settings: Settings, owned: OwnedSearch
) -> None:
    stranger = register(settings)

    response = funnel_over_http(
        settings, token=stranger["accessToken"], search_id=owned.search_id
    )

    assert (response.status_code, response.json()) == (
        404,
        problem_body(404, type="not_found", title="Not found"),
    )
