import re
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from functools import cache
from types import ModuleType
from uuid import UUID

import httpx2
import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.api.routes import (
    forecast,
    funnel,
    insights,
    match_validation,
    reasons,
    resume_ab,
    sankey,
    sources,
    timings,
)
from app.metrics.match_validation import match_validation as validated_scores
from tests.factories import (
    SEARCH_ID,
    SIGNER,
    USER_ID,
    auth_app,
    bearer,
    match_scores_frame,
    serving,
    stage_events_frame,
)
from tests.golden.export import METRICS
from tests.golden.story import design_story
from tests.services.test_cache import FakeRedis

OTHER_USER_ID = UUID("0196f0a1-7c2e-7b3d-8a41-5e6f7a8b9cff")
QUERY = {"searchId": str(SEARCH_ID)}
QUERY_HASH = "f5386c512eee2cc8"
NO_STORE = "private, max-age=0"
STRONG_ETAG = re.compile(r'"[0-9a-f]{64}"')


@dataclass(frozen=True)
class CachedRoute:
    module: ModuleType
    service: str
    metric: str


CACHED_ROUTES: dict[str, CachedRoute] = {
    "/analytics/funnel": CachedRoute(funnel, "search_funnel", "funnel"),
    "/analytics/sankey": CachedRoute(sankey, "search_sankey", "sankey"),
    "/analytics/reasons": CachedRoute(reasons, "search_reasons", "reasons"),
    "/analytics/sources": CachedRoute(sources, "search_sources", "sources"),
    "/analytics/timings": CachedRoute(timings, "search_timings", "timings"),
    "/analytics/forecast": CachedRoute(forecast, "search_forecast", "forecast"),
    "/analytics/insights": CachedRoute(insights, "search_insights", "insights"),
    "/analytics/resume-ab": CachedRoute(resume_ab, "user_resume_ab", "resume_ab"),
    "/analytics/match-validation": CachedRoute(
        match_validation, "user_match_validation", "match_validation"
    ),
}


@cache
def answer_of(metric: str) -> BaseModel:
    if metric == "match_validation":
        return validated_scores(stage_events_frame([]), scores=match_scores_frame([]))
    return METRICS[metric](design_story())


@dataclass
class Service:
    answer: BaseModel
    calls: int = 0

    async def __call__(self, *_: object, **__: object) -> BaseModel:
        self.calls += 1
        return self.answer


@dataclass(frozen=True)
class Served:
    client: TestClient
    service: Service
    redis: FakeRedis


@contextmanager
def served(monkeypatch: pytest.MonkeyPatch, *, path: str) -> Iterator[Served]:
    route = CACHED_ROUTES[path]
    service = Service(answer_of(route.metric))
    monkeypatch.setattr(route.module, route.service, service)
    app = auth_app()
    app.state.redis = FakeRedis()
    with serving(app) as client:
        yield Served(client, service, app.state.redis)


def fetched(
    served: Served, *, path: str, headers: dict[str, str] | None = None
) -> httpx2.Response:
    token = bearer(SIGNER.user_token())
    return served.client.get(path, params=QUERY, headers=token | (headers or {}))


CACHED = pytest.mark.parametrize("path", list(CACHED_ROUTES))


@CACHED
def test_answers_the_body_with_a_strong_etag_and_a_private_revalidation(
    monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    with served(monkeypatch, path=path) as app:
        response = fetched(app, path=path)

    assert (response.status_code, response.headers["cache-control"]) == (200, NO_STORE)
    assert STRONG_ETAG.fullmatch(response.headers["etag"])
    assert response.json() == answer_of(CACHED_ROUTES[path].metric).model_dump(
        by_alias=True, mode="json"
    )


IF_NONE_MATCH = {
    "the same tag": "{etag}",
    "a weak copy": "W/{etag}",
    "one tag of a list": '"0000", {etag}',
    "any tag": "*",
}


@CACHED
@pytest.mark.parametrize("form", list(IF_NONE_MATCH.values()), ids=list(IF_NONE_MATCH))
def test_answers_not_modified_with_an_empty_body_for_a_matching_tag(
    monkeypatch: pytest.MonkeyPatch, *, path: str, form: str
) -> None:
    with served(monkeypatch, path=path) as app:
        etag = fetched(app, path=path).headers["etag"]
        response = fetched(
            app, path=path, headers={"if-none-match": form.format(etag=etag)}
        )

    assert (
        response.status_code,
        response.content,
        response.headers["etag"],
        response.headers["cache-control"],
    ) == (304, b"", etag, NO_STORE)


@CACHED
def test_answers_the_full_body_for_a_stale_tag(
    monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    with served(monkeypatch, path=path) as app:
        fresh = fetched(app, path=path)
        response = fetched(app, path=path, headers={"if-none-match": '"stale"'})

    assert (response.status_code, response.content) == (200, fresh.content)


@CACHED
def test_answers_a_second_load_without_computing_the_metric_again(
    monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    with served(monkeypatch, path=path) as app:
        first, second = fetched(app, path=path), fetched(app, path=path)

    assert (first.content, app.service.calls) == (second.content, 1)


def entry(user_id: UUID, *, path: str) -> str:
    metric = path.removeprefix("/analytics/")
    return f"analytics:{user_id}:v0:{metric}:{QUERY_HASH}"


@CACHED
def test_keeps_the_answers_of_two_users_with_the_same_query_apart(
    monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    other = bearer(SIGNER.user_token(sub=str(OTHER_USER_ID)))
    with served(monkeypatch, path=path) as app:
        fetched(app, path=path)
        app.client.get(path, params=QUERY, headers=other)

    assert sorted(app.redis.bodies) == sorted(
        [entry(USER_ID, path=path), entry(OTHER_USER_ID, path=path)]
    )
    assert app.service.calls == 2
