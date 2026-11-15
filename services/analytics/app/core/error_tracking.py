import re
from typing import Any, Final, Literal, get_args

import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.types import Event, Hint

from app.core.config import DEPENDENCY_LIMITS, Settings

SERVICE_NAME = "analytics"
URL_TAIL = re.compile(r"[?#]")
type UserTextKey = Literal[
    "message", "logentry", "user", "extra", "breadcrumbs", "request"
]
USER_TEXT_KEYS: Final[tuple[UserTextKey, ...]] = get_args(UserTextKey.__value__)


def scrubbed_request(request: dict[str, object]) -> dict[str, object]:
    route = URL_TAIL.split(str(request.get("url", "")))[0]
    kept = {"url": route, "method": request.get("method")}
    return {key: value for key, value in kept.items() if value not in (None, "")}


def scrubbed_exception(exception: dict[str, Any]) -> dict[str, Any]:
    kept = {key: value for key, value in exception.items() if key != "value"}
    stacktrace = exception.get("stacktrace")
    if stacktrace is None:
        return kept
    frames = [
        {key: value for key, value in frame.items() if key != "vars"}
        for frame in stacktrace.get("frames", [])
    ]
    return kept | {"stacktrace": stacktrace | {"frames": frames}}


def fingerprint_of(values: list[dict[str, Any]]) -> list[str] | None:
    thrown = (values or [{}])[-1]
    frames = (thrown.get("stacktrace") or {}).get("frames", [])
    in_app = [frame for frame in frames if frame.get("in_app") is not False]
    if not in_app:
        return None
    top = in_app[-1]
    route = URL_TAIL.split(top.get("filename") or "")[0]
    return [thrown.get("type") or "Error", route, top.get("function") or ""]


def scrub_event(event: Event, hint: Hint) -> Event:
    scrubbed = event.copy()
    for key in USER_TEXT_KEYS:
        scrubbed.pop(key, None)
    request = event.get("request")
    if request is not None:
        scrubbed["request"] = scrubbed_request(request)
    exception = event.get("exception")
    if exception is not None:
        values = [scrubbed_exception(value) for value in exception.get("values", [])]
        scrubbed["exception"] = exception | {"values": values}
        fingerprint = fingerprint_of(values)
        if fingerprint is not None:
            scrubbed["fingerprint"] = fingerprint
    return scrubbed


def install_error_tracking(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        release=settings.sentry_release or None,
        data_collection={
            "user_info": False,
            "cookies": {"mode": "off"},
            "http_headers": {"request": {"mode": "off"}},
            "http_bodies": [],
            "url_query_params": {"mode": "off"},
            "graphql": {"document": False, "variables": False},
            "gen_ai": {"inputs": False, "outputs": False},
            "database_query_data": False,
            "queues": False,
            "stack_frame_variables": False,
        },
        max_breadcrumbs=0,
        auto_enabling_integrations=False,
        integrations=[LoggingIntegration(level=None, event_level=None)],
        traces_sample_rate=None,
        shutdown_timeout=DEPENDENCY_LIMITS.connect,
        before_send=scrub_event,
    )
    sentry_sdk.get_global_scope().set_tag("service", SERVICE_NAME)


def capture_unhandled(error: Exception, *, request_id: str) -> None:
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("requestId", request_id)
        scope.capture_exception(error)
