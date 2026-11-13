from typing import Any

import pytest

from app.core.config import Settings
from app.factory import create_app
from tests.api_client import analytics_body, api_call, register, rejected_at_screening
from tests.metrics.sources_design import EASY_APPLY
from tests.routes.test_sources import SOURCES_PATH
from tests_api.conftest import OwnedSearch, finished_search, owned_search

pytestmark = pytest.mark.enable_socket

ONE_OF_FIVE = {
    "status": "insufficient_data",
    "have": 1,
    "need": 4,
    "message": "Ще 4 відгуки до першого висновку",
}
NO_SILENT_GHOSTS = {"total": 0, "easyApply": 0}


def sources_over_http(
    settings: Settings, owned: OwnedSearch, *, query: dict[str, str]
) -> Any:
    return analytics_body(
        create_app(settings), token=owned.token, query=(SOURCES_PATH, query)
    )


def test_answers_a_source_row_for_the_owned_search(
    settings: Settings, owned: OwnedSearch
) -> None:
    body = sources_over_http(settings, owned, query={"searchId": owned.search_id})

    assert body == {
        "sources": [
            {
                "source": "other",
                "applications": 1,
                "screenings": 1,
                "easyApply": 0,
                "conversion": ONE_OF_FIVE,
                "ghostRate": ONE_OF_FIVE,
                "medianResponse": ONE_OF_FIVE,
                "note": None,
            }
        ],
        "silentGhosts": NO_SILENT_GHOSTS,
    }


def test_counts_a_linkedin_easy_apply_application_created_through_the_api(
    settings: Settings,
) -> None:
    applicant = owned_search(settings, register(settings))
    created = {
        "company": "Acme",
        "position": "QA",
        "source": "linkedin",
        "url": EASY_APPLY,
    }
    request = ("POST", "/applications", created)
    api_call(settings, token=applicant.token, request=request)

    body = sources_over_http(settings, applicant, query={})

    assert [
        (row["source"], row["applications"], row["easyApply"])
        for row in body["sources"]
    ] == [("other", 1, 0), ("linkedin", 1, 1)]


def test_leaves_the_applications_of_a_finished_search_out_like_the_reasons(
    settings: Settings,
) -> None:
    finished = finished_search(settings)
    rejected_at_screening(settings, token=finished.token, reason="skills_gap")

    body = sources_over_http(settings, finished, query={})

    assert [(row["source"], row["applications"]) for row in body["sources"]] == [
        ("other", 1)
    ]
    assert body["silentGhosts"] == NO_SILENT_GHOSTS
