import json
from typing import Any

import pytest
from redis import Redis

from app.core.config import DEPENDENCY_LIMITS, Settings
from app.factory import create_app
from tests.api_client import (
    WARM_CALLS,
    analytics_body,
    analytics_client,
    api_call,
    fresh_keys,
    rejected_at_screening,
    timed_answer,
    warm_calls,
    with_redis_on,
)
from tests.factories import OUTAGES, Outage
from tests.routes.test_funnel import SCREENING
from tests.routes.test_reasons import REASONS_PATH, SUMMARY_PATH
from tests_api.conftest import OwnedSearch, finished_search

pytestmark = pytest.mark.enable_socket

UNSPECIFIED_AT_SCREENING = {
    "stage": "screening",
    "total": 1,
    "reasons": [{"code": "unspecified", "count": 1}],
}
SKILLS_GAP_AT_SCREENING = {
    "stage": "screening",
    "total": 1,
    "reasons": [{"code": "skills_gap", "count": 1}],
}
MARKER_BODY = {"stage": "screening", "total": 99, "reasons": []}
TOAST_LIMIT_SECONDS = 0.05
STAGE_KEYS = [
    "reasons",
    "sides",
    "stage",
    "stated",
    "top",
    "total",
    "trend",
    "unstated",
]


def node_summary(settings: Settings, owned: OwnedSearch) -> Any:
    path = "/applications/reasons-summary?stage=screening"
    return api_call(settings, token=owned.token, request=("GET", path, None))


def summary_over_http(settings: Settings, owned: OwnedSearch) -> Any:
    return analytics_body(
        create_app(settings), token=owned.token, query=(SUMMARY_PATH, SCREENING)
    )


def test_answers_the_same_summary_as_the_api_for_the_same_user(
    settings: Settings, owned: OwnedSearch
) -> None:
    analytics = summary_over_http(settings, owned)

    assert analytics == node_summary(settings, owned) == UNSPECIFIED_AT_SCREENING


def test_leaves_the_rejections_of_a_finished_search_out_like_the_api(
    settings: Settings,
) -> None:
    finished = finished_search(settings)
    rejected_at_screening(settings, token=finished.token, reason="skills_gap")
    analytics = summary_over_http(settings, finished)

    assert analytics == node_summary(settings, finished) == SKILLS_GAP_AT_SCREENING


def test_answers_the_stored_summary_while_nothing_changed(
    settings: Settings, owned: OwnedSearch, *, cache: Redis
) -> None:
    scope = f"screening:{owned.search_id}"
    pattern = f"analytics:{owned.user_id}:reasons-summary:{scope}:*"
    [key] = fresh_keys(
        cache, pattern=pattern, answer=lambda: summary_over_http(settings, owned)
    )
    cache.set(key, json.dumps(MARKER_BODY), keepttl=True)

    try:
        assert summary_over_http(settings, owned) == MARKER_BODY
    finally:
        cache.delete(key)


def test_counts_a_rejection_just_recorded_and_drops_it_once_undone(
    settings: Settings, owned: OwnedSearch
) -> None:
    before = summary_over_http(settings, owned)
    rejected = rejected_at_screening(settings, token=owned.token, reason="skills_gap")
    counted = summary_over_http(settings, owned)
    undo = ("POST", f"/applications/{rejected}/events/undo-last", None)
    api_call(settings, token=owned.token, request=undo)

    assert (before, summary_over_http(settings, owned)) == (
        UNSPECIFIED_AT_SCREENING,
        UNSPECIFIED_AT_SCREENING,
    )
    assert counted == {
        "stage": "screening",
        "total": 2,
        "reasons": [
            {"code": "skills_gap", "count": 1},
            {"code": "unspecified", "count": 1},
        ],
    }


def test_answers_the_toast_summary_within_50_ms_once_cached(
    settings: Settings, owned: OwnedSearch
) -> None:
    statuses, median = warm_calls(
        create_app(settings), token=owned.token, query=(SUMMARY_PATH, SCREENING)
    )

    assert statuses == [200] * WARM_CALLS
    assert median < TOAST_LIMIT_SECONDS


@pytest.mark.parametrize("outage", list(OUTAGES.values()), ids=list(OUTAGES))
def test_answers_the_summary_from_postgres_when_redis_is_down(
    settings: Settings,
    owned: OwnedSearch,
    *,
    outage: Outage,
) -> None:
    with outage() as port:
        status, body, elapsed = timed_answer(
            create_app(with_redis_on(settings, port)),
            token=owned.token,
            query=(SUMMARY_PATH, SCREENING),
        )

    assert (status, body) == (200, UNSPECIFIED_AT_SCREENING)
    assert elapsed < DEPENDENCY_LIMITS.ping + 0.5


def test_lists_the_reasons_of_the_owned_search_by_rejectable_stage(
    settings: Settings, owned: OwnedSearch
) -> None:
    with analytics_client(create_app(settings), token=owned.token) as client:
        response = client.get(REASONS_PATH, params={"searchId": owned.search_id})

    body = response.json()
    stages = {stage["stage"]: stage for stage in body["stages"]}
    assert (response.status_code, sorted(body)) == (200, ["headline", "stages"])
    assert list(stages) == ["applied", "screening", "tech_interview", "final"]
    assert [sorted(stage) for stage in stages.values()] == [STAGE_KEYS] * 4
    assert stages["screening"]["unstated"] == [{"code": "unspecified", "count": 1}]
