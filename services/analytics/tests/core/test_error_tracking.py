import gzip
import json
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any

import httpx2
import pytest
import sentry_sdk
from fastapi import APIRouter, FastAPI
from sentry_sdk.utils import event_from_exception

from app.core.config import DEPENDENCY_LIMITS
from app.core.error_tracking import scrub_event
from app.factory import create_app
from tests.factories import (
    OUTAGES,
    REQUEST_ID,
    Outage,
    QuietHandler,
    local_http_server,
    problem_body,
    serving,
    settings_for,
)

if TYPE_CHECKING:
    from sentry_sdk.types import Event

LEAKED_EMAIL = "ivan.petrenko@example.com"
LEAKED_NOTE = "Нотатка: рекрутер обіцяв офер до пʼятниці"
DSN_PUBLIC_KEY = "5f3a9c0e1b2d4e6f8a7b6c5d4e3f2a1b"
INTERNAL_BODY = problem_body(500, type="internal_error", title="Internal error")
ANSWER_LIMIT_SECONDS = 1.0
FLUSH_SLACK_SECONDS = 0.5
CRASH_PATH = "/probe/crash"

crash = APIRouter()


@pytest.fixture(autouse=True)
def detached_sdk() -> Iterator[None]:
    yield
    sentry_sdk.get_client().close(timeout=0)
    sentry_sdk.get_global_scope().set_client(None)


def dsn_at(port: int) -> str:
    return f"http://{DSN_PUBLIC_KEY}@127.0.0.1:{port}/1"


@crash.get(CRASH_PATH)
def crash_with_user_text() -> None:
    contact = LEAKED_EMAIL
    raise RuntimeError(f"{contact} {LEAKED_NOTE}")


@contextmanager
def error_collector() -> Iterator[tuple[str, list[bytes]]]:
    envelopes: list[bytes] = []

    class EnvelopeHandler(QuietHandler):
        def do_POST(self) -> None:
            body = self.rfile.read(int(self.headers["Content-Length"]))
            zipped = self.headers["Content-Encoding"] == "gzip"
            envelopes.append(gzip.decompress(body) if zipped else body)
            self.send_response(200)
            self.end_headers()

    with local_http_server(EnvelopeHandler) as port:
        yield dsn_at(port), envelopes


def crashed(dsn: str) -> tuple[httpx2.Response, float]:
    app: FastAPI = create_app(settings_for().model_copy(update={"sentry_dsn": dsn}))
    app.include_router(crash)
    with serving(app) as client:
        started = time.monotonic()
        response = client.get(CRASH_PATH, headers={"x-request-id": REQUEST_ID})
        return response, time.monotonic() - started


def flushed_in() -> float:
    started = time.monotonic()
    sentry_sdk.flush(timeout=DEPENDENCY_LIMITS.connect)
    return time.monotonic() - started


def events_in(envelopes: list[bytes]) -> list[dict[str, Any]]:
    items = [json.loads(line) for body in envelopes for line in body.splitlines()]
    return [item for item in items if "exception" in item]


def frame_vars(event: dict[str, Any]) -> list[object]:
    return [
        frame["vars"]
        for value in event["exception"]["values"]
        for frame in value["stacktrace"]["frames"]
        if "vars" in frame
    ]


@pytest.mark.enable_socket
def test_reports_an_unhandled_error_without_the_user_text_it_carried() -> None:
    with error_collector() as (dsn, envelopes):
        response, _ = crashed(dsn)
        flushed_in()

    [event] = events_in(envelopes)
    sent = json.dumps(event, ensure_ascii=False)
    assert (response.status_code, response.json()) == (500, INTERNAL_BODY)
    assert (event["tags"]["service"], event["tags"]["requestId"]) == (
        "analytics",
        REQUEST_ID,
    )
    assert [value["type"] for value in event["exception"]["values"]] == ["RuntimeError"]
    assert (LEAKED_EMAIL in sent, LEAKED_NOTE in sent, frame_vars(event)) == (
        False,
        False,
        [],
    )


@pytest.mark.enable_socket
@pytest.mark.parametrize("outage", list(OUTAGES.values()), ids=list(OUTAGES))
def test_answers_the_500_in_time_when_the_error_collector_is_down(
    outage: Outage,
) -> None:
    with outage() as port:
        response, answered_in = crashed(dsn_at(port))
        flush_took = flushed_in()

    assert (response.status_code, response.json()) == (500, INTERNAL_BODY)
    assert answered_in < ANSWER_LIMIT_SECONDS
    assert flush_took < DEPENDENCY_LIMITS.connect + FLUSH_SLACK_SECONDS


def raise_in_funnel() -> None:
    raise ValueError(LEAKED_NOTE)


def raise_in_sankey() -> None:
    raise ValueError(LEAKED_NOTE)


def fingerprint_of(raise_error: Callable[[], None]) -> object:
    try:
        raise_error()
    except ValueError as error:
        event, hint = event_from_exception(error)
        return scrub_event(event, hint).get("fingerprint")
    return None


def test_two_errors_raised_in_different_functions_get_different_fingerprints() -> None:
    assert [fingerprint_of(raise_in_funnel), fingerprint_of(raise_in_sankey)] == [
        ["ValueError", "tests/core/test_error_tracking.py", "raise_in_funnel"],
        ["ValueError", "tests/core/test_error_tracking.py", "raise_in_sankey"],
    ]


def test_scrubs_user_text_and_frame_vars_but_keeps_what_finds_the_crash() -> None:
    event: Event = {
        "event_id": "5f3a9c0e1b2d4e6f8a7b6c5d4e3f2a1b",
        "message": LEAKED_EMAIL,
        "logentry": {"message": LEAKED_NOTE},
        "user": {"email": LEAKED_EMAIL, "ip_address": "10.0.0.7"},
        "extra": {"note": LEAKED_NOTE},
        "breadcrumbs": {"values": [{"message": LEAKED_NOTE}]},
        "request": {
            "url": f"http://analytics:8000/analytics/funnel?email={LEAKED_EMAIL}#n",
            "method": "GET",
            "query_string": f"email={LEAKED_EMAIL}",
            "headers": {"Authorization": "Bearer token"},
            "cookies": {"session": "s"},
            "data": {"note": LEAKED_NOTE},
            "env": {"REMOTE_ADDR": "10.0.0.7"},
        },
        "exception": {
            "values": [
                {
                    "type": "RuntimeError",
                    "value": LEAKED_NOTE,
                    "stacktrace": {
                        "frames": [
                            {
                                "filename": "app/metrics/funnel.py?v=1#top",
                                "function": "crash",
                                "lineno": 12,
                                "vars": {"c": "x"},
                            },
                            {"filename": "fastapi/routing.py", "in_app": False},
                        ]
                    },
                }
            ]
        },
        "tags": {"requestId": REQUEST_ID},
    }

    assert scrub_event(event, {}) == {
        "event_id": "5f3a9c0e1b2d4e6f8a7b6c5d4e3f2a1b",
        "request": {"url": "http://analytics:8000/analytics/funnel", "method": "GET"},
        "exception": {
            "values": [
                {
                    "type": "RuntimeError",
                    "stacktrace": {
                        "frames": [
                            {
                                "filename": "app/metrics/funnel.py?v=1#top",
                                "function": "crash",
                                "lineno": 12,
                            },
                            {"filename": "fastapi/routing.py", "in_app": False},
                        ]
                    },
                }
            ]
        },
        "tags": {"requestId": REQUEST_ID},
        "fingerprint": ["RuntimeError", "app/metrics/funnel.py", "crash"],
    }
