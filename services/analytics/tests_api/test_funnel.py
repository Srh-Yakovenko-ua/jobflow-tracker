from typing import Any

import httpx2
import pytest

from app.core.config import Settings
from app.factory import create_app
from tests.api_client import application_through, register
from tests.factories import bearer, problem_body, uvicorn_serving
from tests.routes.test_funnel import FUNNEL_PATH, SEARCH_PATH_IDS, SEARCH_PATHS
from tests_api.conftest import OwnedSearch, active_search

pytestmark = pytest.mark.enable_socket

SANKEY_LINKS = {
    "no split": ({}, "rejected"),
    "reason split": ({"split": "reason"}, "unspecified"),
}

INTERVIEW_PATHS = [
    ["screening", "offer"],
    ["tech_interview", "tech_interview", "final", "offer"],
    ["screening", "tech_interview", "rejected"],
    ["screening", "final"],
]


def funnel_over_http(
    settings: Settings,
    *,
    token: str,
    search_id: str,
    path: str = FUNNEL_PATH,
    query: dict[str, str] | None = None,
) -> Any:
    with uvicorn_serving(create_app(settings)) as base_url:
        return httpx2.get(
            f"{base_url}{path}",
            params={"searchId": search_id} | (query or {}),
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


@pytest.mark.parametrize(
    ("query", "rejected_node"), list(SANKEY_LINKS.values()), ids=list(SANKEY_LINKS)
)
def test_draws_a_rejection_after_screening_as_sankey_links_over_http(
    settings: Settings, owned: OwnedSearch, *, query: dict[str, str], rejected_node: str
) -> None:
    response = funnel_over_http(
        settings,
        token=owned.token,
        search_id=owned.search_id,
        path="/analytics/sankey",
        query=query,
    )

    body = response.json()
    assert (response.status_code, body["merged"]) == (200, body["detailed"])
    assert body["detailed"]["links"] == [
        {"from": "applied", "to": "screening", "flow": 1, "ghost": False},
        {"from": "screening", "to": rejected_node, "flow": 1, "ghost": False},
    ]


@pytest.mark.parametrize(("path", "query"), SEARCH_PATHS, ids=SEARCH_PATH_IDS)
def test_answers_not_found_for_another_users_search(
    settings: Settings, owned: OwnedSearch, *, path: str, query: dict[str, str]
) -> None:
    stranger = register(settings)

    response = funnel_over_http(
        settings,
        token=stranger["accessToken"],
        search_id=owned.search_id,
        path=path,
        query=query,
    )

    assert (response.status_code, response.json()) == (
        404,
        problem_body(404, type="not_found", title="Not found"),
    )


def test_the_funnel_kpi_and_the_search_summary_count_the_same_interviews(
    settings: Settings,
) -> None:
    token = register(settings)["accessToken"]
    for path in INTERVIEW_PATHS:
        application_through(settings, token=token, path=path)
    active = active_search(settings, token=token)

    funnel = funnel_over_http(settings, token=token, search_id=str(active["id"]))

    interviews = funnel.json()["kpis"]["interviews"]["total"]
    assert (active["interviews"], interviews) == (3, 3)
