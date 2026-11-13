import json
import socket
import threading
import time
from collections.abc import Callable, Iterator, Sequence
from contextlib import AbstractContextManager, contextmanager, nullcontext
from dataclasses import asdict, dataclass, field, fields
from datetime import UTC, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from uuid import UUID, uuid4, uuid5

import jwt
import pandas as pd
import pytest
import uvicorn
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm

from app.core.auth import CurrentUserId, KeySource, get_key_source
from app.core.config import Settings
from app.factory import create_app

REQUIRED_ENV = {
    "DATABASE_URL_ANALYTICS": "postgresql://jobflow_analytics:test@db:5432/jobflow",
    "REDIS_URL": "redis://cache:6379",
    "API_URL": "http://api:4000/",
    "WEB_ORIGIN": "http://localhost:3000",
}

UNUSED_PORT = 9
WEB_ORIGIN = REQUIRED_ENV["WEB_ORIGIN"]

USER_ID = UUID("0196f0a1-7c2e-7b3d-8a41-5e6f7a8b9c0d")
SEARCH_ID = UUID("0196f0a1-7c2e-7b3d-8a41-5e6f7a8b9c1e")
EVENTS_BASE_TIME = datetime(2026, 11, 2, 9, 0, tzinfo=UTC)


def application(index: int) -> UUID:
    return uuid5(SEARCH_ID, f"application-{index}")


@dataclass(frozen=True)
class StageEvent:
    id: UUID
    application_id: UUID
    compensates_event_id: UUID | None
    from_stage: str | None
    to_stage: str
    reason_code: str | None


def stage_event(
    application_id: UUID,
    to_stage: str,
    *,
    from_stage: str | None = None,
    compensates: UUID | None = None,
    reason: str | None = None,
) -> StageEvent:
    move = f"{application_id}:{from_stage}:{to_stage}:{compensates}"
    return StageEvent(
        id=uuid5(application_id, move),
        application_id=application_id,
        compensates_event_id=compensates,
        from_stage=from_stage,
        to_stage=to_stage,
        reason_code=reason,
    )


def moves(application_id: UUID, path: list[str]) -> list[StageEvent]:
    return [
        stage_event(application_id, to_stage, from_stage=from_stage)
        for from_stage, to_stage in zip([None, *path], path, strict=False)
    ]


def records_frame(rows: Sequence[Any], *, record: type[Any]) -> pd.DataFrame:
    columns = [column.name for column in fields(record)]
    return pd.DataFrame([asdict(row) for row in rows], columns=columns)


@dataclass(frozen=True)
class ApplicationSource:
    application_id: UUID
    source: str
    url: str | None = None


def application_sources_frame(rows: list[ApplicationSource]) -> pd.DataFrame:
    return records_frame(rows, record=ApplicationSource)


@dataclass(frozen=True)
class VersionLink:
    application_id: UUID
    resume_version_id: UUID
    number: int
    title: str


def version_links_frame(rows: list[VersionLink]) -> pd.DataFrame:
    return records_frame(rows, record=VersionLink)


@dataclass(frozen=True)
class Followup:
    application_id: UUID
    occurred_at: datetime


def followups_frame(rows: list[Followup]) -> pd.DataFrame:
    return records_frame(rows, record=Followup)


def stage_events_frame(
    rows: list[StageEvent], *, occurred_at: list[datetime] | None = None
) -> pd.DataFrame:
    frame = records_frame(rows, record=StageEvent)
    frame["occurred_at"] = occurred_at or [
        EVENTS_BASE_TIME + timedelta(hours=order) for order in range(len(rows))
    ]
    return frame.astype({"from_stage": "str", "to_stage": "str", "reason_code": "str"})


type TimedMove = tuple[str, datetime]


def day(offset: float) -> datetime:
    return EVENTS_BASE_TIME + timedelta(days=offset)


def timed_frame(paths: list[list[TimedMove]]) -> pd.DataFrame:
    rows = [
        move
        for index, path in enumerate(paths)
        for move in moves(application(index), [stage for stage, _ in path])
    ]
    times = [moment for path in paths for _, moment in path]
    return stage_events_frame(rows, occurred_at=times)


def settings_for(
    *,
    postgres_port: int = UNUSED_PORT,
    redis_port: int = UNUSED_PORT,
    api_port: int = UNUSED_PORT,
) -> Settings:
    return Settings(
        _env_file=None,
        database_url_analytics=f"postgresql://jobflow_analytics:test@127.0.0.1:{postgres_port}/jobflow",
        redis_url=f"redis://127.0.0.1:{redis_port}",
        api_url=f"http://127.0.0.1:{api_port}",
        web_origin=WEB_ORIGIN,
    )


@contextmanager
def serving(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def closed_port() -> int:
    with socket.create_server(("127.0.0.1", 0)) as listener:
        port: int = listener.getsockname()[1]
    return port


@contextmanager
def silent_listener() -> Iterator[int]:
    with socket.create_server(("127.0.0.1", 0), backlog=8) as listener:
        yield listener.getsockname()[1]


type Outage = Callable[[], AbstractContextManager[int]]

OUTAGES: dict[str, Outage] = {
    "refused": lambda: nullcontext(closed_port()),
    "silent": silent_listener,
}


REQUEST_ID = "0d6f3a2b-7c41-4e8a-9b15-2f6c8d4e1a73"
TOKEN_LIFETIME_SECONDS = 900


def problem_body(
    status: int,
    *,
    type: str,
    title: str,
    detail: str | None = None,
    request_id: str = REQUEST_ID,
) -> dict[str, Any]:
    described = {} if detail is None else {"detail": detail}
    return (
        {"type": type, "title": title, "status": status}
        | described
        | {"requestId": request_id}
    )


UNAUTHORIZED_BODY = problem_body(401, type="unauthorized", title="Unauthorized")
EXPIRED_BODY = problem_body(401, type="token_expired", title="Token expired")


@dataclass(frozen=True)
class TokenSigner:
    kid: str
    key: rsa.RSAPrivateKey = field(
        default_factory=lambda: rsa.generate_private_key(65537, 2048)
    )

    def jwk(self) -> dict[str, Any]:
        public = RSAAlgorithm.to_jwk(self.key.public_key(), as_dict=True)
        return {**public, "kid": self.kid, "alg": "RS256", "use": "sig"}

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        return jwt.PyJWK(self.jwk())

    def user_token(self, **claims: Any) -> str:
        issued = int(time.time())
        payload = {
            "sub": str(USER_ID),
            "jti": str(uuid4()),
            "scope": "user analytics:read",
            "iat": issued,
            "exp": issued + TOKEN_LIFETIME_SECONDS,
        }
        headers = {"kid": self.kid}
        return jwt.encode(payload | claims, self.key, "RS256", headers=headers)

    def expired_token(self) -> str:
        issued = int(time.time()) - 2 * TOKEN_LIFETIME_SECONDS
        return self.user_token(iat=issued, exp=issued + TOKEN_LIFETIME_SECONDS)


SIGNER = TokenSigner(kid="analytics-test-key-a")
ROTATED_SIGNER = TokenSigner(kid="analytics-test-key-b")


def bearer(token: str) -> dict[str, str]:
    return {"authorization": f"Bearer {token}", "x-request-id": REQUEST_ID}


def with_payload_of(token: str, donor: str) -> str:
    header, _, signature = token.split(".")
    return ".".join([header, donor.split(".")[1], signature])


probe = APIRouter()


@probe.get("/probe/me")
def probe_me(user_id: CurrentUserId) -> dict[str, str]:
    return {"userId": str(user_id)}


def with_probe(app: FastAPI) -> FastAPI:
    app.include_router(probe)
    return app


def auth_app(
    key_source: KeySource = SIGNER, *, settings: Settings | None = None
) -> FastAPI:
    app = with_probe(create_app(settings or settings_for()))
    app.dependency_overrides[get_key_source] = lambda: key_source
    return app


REFUSED = (422, "validation_error")


def refusal(path: str, query: dict[str, str]) -> tuple[tuple[int, str], list[str]]:
    with serving(auth_app()) as client:
        response = client.get(path, params=query, headers=bearer(SIGNER.user_token()))
    body = response.json()
    fields = [error["path"] for error in body.get("errors", [])]
    return (response.status_code, body.get("type")), fields


SERVER_START_SECONDS = 5.0
SERVER_POLL_SECONDS = 0.01


def wait_until_started(server: uvicorn.Server) -> None:
    deadline = time.monotonic() + SERVER_START_SECONDS
    while not server.started:
        if time.monotonic() > deadline:
            raise TimeoutError("uvicorn did not start")
        time.sleep(SERVER_POLL_SECONDS)


@contextmanager
def uvicorn_serving(app: FastAPI) -> Iterator[str]:
    port = closed_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        wait_until_started(server)
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        thread.join(SERVER_START_SECONDS)


@dataclass
class FakeClock:
    now: float = 0.0

    def monotonic(self) -> float:
        return self.now


def jwks_cooldown_clock(monkeypatch: pytest.MonkeyPatch) -> FakeClock:
    clock = FakeClock()
    monkeypatch.setattr(jwt.jwks_client, "time", clock)
    return clock


@dataclass
class JwksServer:
    signers: list[TokenSigner]
    hits: int = 0
    port: int = UNUSED_PORT

    def key_set(self) -> bytes:
        self.hits += 1
        return json.dumps({"keys": [signer.jwk() for signer in self.signers]}).encode()


@contextmanager
def jwks_server(signers: list[TokenSigner]) -> Iterator[JwksServer]:
    state = JwksServer(signers)

    class KeySetHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            body = state.key_set()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_: Any) -> None:
            return

    with ThreadingHTTPServer(("127.0.0.1", 0), KeySetHandler) as server:
        state.port = server.server_address[1]
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            yield state
        finally:
            server.shutdown()
