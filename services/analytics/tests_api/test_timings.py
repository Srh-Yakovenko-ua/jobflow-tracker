import json
from typing import Any

import pytest
from redis import Redis

from app.core.config import DEPENDENCY_LIMITS, Settings
from app.factory import create_app
from tests.api_client import (
    WARM_CALLS,
    analytics_body,
    fresh_keys,
    register,
    rejected_at_screening,
    timed_answer,
    warm_calls,
    with_redis_on,
)
from tests.factories import OUTAGES, Outage
from tests.routes.test_timings import NORMS_PATH, TIMINGS_PATH
from tests_api.conftest import OwnedSearch, finish_search, owned_search

pytestmark = pytest.mark.enable_socket

NO_NORMS_BODY = {
    "stageNormDays": {
        "applied": None,
        "screening": None,
        "tech_interview": None,
        "final": None,
    },
    "medianDaysToOffer": None,
}
MARKER_BODY = {
    "stageNormDays": {
        "applied": 99,
        "screening": 98,
        "tech_interview": 97,
        "final": 96,
    },
    "medianDaysToOffer": 95,
}
NORMS_LIMIT_SECONDS = 0.03
NORMS: tuple[str, dict[str, str]] = (NORMS_PATH, {})


def norms_over_http(settings: Settings, owned: OwnedSearch) -> Any:
    return analytics_body(create_app(settings), token=owned.token, query=NORMS)


def timings_over_http(
    settings: Settings, owned: OwnedSearch, *, query: dict[str, str]
) -> Any:
    return analytics_body(
        create_app(settings), token=owned.token, query=(TIMINGS_PATH, query)
    )


def test_answers_the_norms_within_30_ms_once_cached(
    settings: Settings, owned: OwnedSearch
) -> None:
    statuses, median = warm_calls(create_app(settings), token=owned.token, query=NORMS)

    assert statuses == [200] * WARM_CALLS
    assert median < NORMS_LIMIT_SECONDS


def test_answers_the_stored_norms_while_nothing_changed(
    settings: Settings, owned: OwnedSearch, *, cache: Redis
) -> None:
    [key] = fresh_keys(
        cache,
        pattern=f"analytics:{owned.user_id}:norms:*",
        answer=lambda: norms_over_http(settings, owned),
    )
    cache.set(key, json.dumps(MARKER_BODY), keepttl=True)

    try:
        assert norms_over_http(settings, owned) == MARKER_BODY
    finally:
        cache.delete(key)


@pytest.mark.parametrize("outage", list(OUTAGES.values()), ids=list(OUTAGES))
def test_answers_the_norms_from_postgres_when_redis_is_down(
    settings: Settings, owned: OwnedSearch, *, outage: Outage
) -> None:
    with outage() as port:
        status, body, elapsed = timed_answer(
            create_app(with_redis_on(settings, port)), token=owned.token, query=NORMS
        )

    assert (status, body) == (200, NO_NORMS_BODY)
    assert elapsed < DEPENDENCY_LIMITS.ping + 0.5


def test_counts_a_finished_search_in_the_norms_but_not_in_the_default_timings(
    settings: Settings,
) -> None:
    applicant = owned_search(settings, register(settings))
    for _ in range(4):
        rejected_at_screening(settings, token=applicant.token, reason="skills_gap")
    finished = finish_search(settings, applicant)

    norms = norms_over_http(settings, finished)
    active = timings_over_http(settings, finished, query={})
    searched = timings_over_http(
        settings, finished, query={"searchId": finished.search_id}
    )

    assert norms == {
        "stageNormDays": {
            "applied": 0,
            "screening": 0,
            "tech_interview": None,
            "final": None,
        },
        "medianDaysToOffer": None,
    }
    assert [stage.get("have") for stage in active["stages"]] == [0, 0, 0, 0]
    assert [stage.get("samples") for stage in searched["stages"]] == [5, 5, None, None]
