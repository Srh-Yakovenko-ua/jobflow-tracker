import json
import time
from dataclasses import dataclass, field, replace
from typing import Any

import httpx
import httpx2
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from jwt.algorithms import RSAAlgorithm

from app.api.deps import get_runtime
from app.core.auth import get_key_source
from app.core.config import Settings
from app.factory import create_app
from app.providers.base import AiProvider, CompletionRequest, Message, VendorSettings
from app.providers.fake import fixture_of

KID = "test-signing-key"
SIGNING_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
SIGNING_JWK = jwt.PyJWK(
    {
        **RSAAlgorithm.to_jwk(SIGNING_KEY.public_key(), as_dict=True),
        "kid": KID,
        "alg": "RS256",
    }
)

COMPLETE_PATH = "/v1/complete/vacancy_parse"
VACANCY_TEXT = "Senior React developer, Acme, remote, 4000-5000 USD"
VACANCY_BODY = {"input": {"text": VACANCY_TEXT}}


def vacancy_field(value: Any, evidence: str | None) -> dict[str, Any]:
    confidence = "missing" if evidence is None else "exact"
    return {"value": value, "confidence": confidence, "evidence": evidence}


PARSED_VACANCY = {
    "company": vacancy_field("Acme", "Acme"),
    "position": vacancy_field("Senior React developer", "Senior React developer"),
    "seniority": vacancy_field("senior", "Senior"),
    "salaryMin": vacancy_field(4000, "4000-5000 USD"),
    "salaryMax": vacancy_field(5000, "4000-5000 USD"),
    "currency": vacancy_field("USD", "USD"),
    "salaryTax": vacancy_field(None, None),
    "location": vacancy_field(None, None),
    "workMode": vacancy_field("remote", "remote"),
    "stack": vacancy_field(["React"], "React"),
    "requirements": vacancy_field([], None),
    "englishLevel": vacancy_field(None, None),
    "sourceGuess": vacancy_field(None, None),
}

UNNAMED_VACANCY = {
    **PARSED_VACANCY,
    "company": vacancy_field(None, None),
    "position": vacancy_field(None, None),
}


RESUME_PATH = "/v1/complete/resume_parse"
RESUME_TEXT = (
    "Frontend developer, Acme, 2021-03 to 2023-02. Built the Acme dashboard in React.\n"
    "Junior developer, 2019-09 to 2021-02. TypeScript, fintech, English B2."
)
RESUME_PAGE = "/9j/4AAQSkZJRgABAQ"
RESUME_FIXTURE: dict[str, Any] = json.loads(fixture_of("resume_parse"))
PROFILED_RESUME = {
    **RESUME_FIXTURE,
    "skills": [
        {**RESUME_FIXTURE["skills"][0], "years": 3.5},
        {**RESUME_FIXTURE["skills"][1], "years": 2.0},
    ],
    "totalYears": 3.5,
}


MATCH_PATH = "/v1/complete/match"
MATCH_FIXTURE: dict[str, Any] = json.loads(fixture_of("match"))
MATCH_PROFILE = {
    "totalYears": 6.0,
    "seniority": "senior",
    "englishLevel": "upper_intermediate",
    "domains": ["e-commerce"],
    "languages": [{"name": "English", "level": "B2"}],
    "skills": [{"name": "React", "years": 6.0}, {"name": "Node.js", "years": 4.0}],
    "leadership": {"hasExperience": False},
}


def match_body(
    *, text: str = VACANCY_TEXT, position: str = "Senior React developer"
) -> Any:
    vacancy = {"position": position, "stack": ["React", "AWS"], "text": text}
    return {"input": {"vacancy": vacancy, "profile": MATCH_PROFILE}}


FOLLOWUP_PATH = "/v1/complete/followup"
FOLLOWUP_FIXTURE: dict[str, Any] = json.loads(fixture_of("followup"))
FOLLOWUP_INPUT = {
    "recruiterFirstName": "Оксана",
    "company": "Acme",
    "position": "Senior React developer",
    "stage": "tech_interview",
    "silenceDays": 6,
    "lastInterview": {"kind": "tech_interview", "date": "2026-09-03"},
    "senderName": "Андрій",
    "language": "uk",
    "tone": "warm",
    "hint": "згадай, що я дорозв'язав задачу з динамічним програмуванням",
}


def followup_body(**overrides: Any) -> Any:
    return {"input": {**FOLLOWUP_INPUT, **overrides}}


def draft_of(words: int, *, ending: str = "") -> str:
    body = " ".join(["слово"] * words)
    return json.dumps({"subject": "Наступний крок", "body": f"{body}{ending}"})


PII_RESUME = (
    "Olena Koval, React developer\n"
    "olena.koval@example.com | +380 67 123 45 67 | @olena_dev\n"
    "вул. Хрещатик, 22, кв. 5, Київ\n"
    "5 years with React and Node.js"
)
SCRUBBED_RESUME = (
    "Olena Koval, React developer\n"
    "[email] | [phone] | [telegram]\n"
    "[address], Київ\n"
    "5 years with React and Node.js"
)


def resume_body(*, text: str = RESUME_TEXT, pages: list[str] | None = None) -> Any:
    return {"input": {"text": text, "pages": pages or []}}


def failing_vacancy(failure: str) -> str:
    return f"{VACANCY_TEXT}\nfake-ai-fail:{failure}"


def service_token(**claims: Any) -> str:
    now = int(time.time())
    defaults = {
        "iss": "jobflow-api",
        "aud": "jobflow-ai",
        "sub": "worker",
        "scope": "ai:invoke",
        "jti": "test-jti",
        "iat": now,
        "exp": now + 60,
    }
    payload = {
        name: value for name, value in (defaults | claims).items() if value is not None
    }
    return jwt.encode(payload, SIGNING_KEY, algorithm="RS256", headers={"kid": KID})


def auth_headers(token: str | None = None) -> dict[str, str]:
    return {
        "authorization": f"Bearer {token or service_token()}",
        "x-request-id": "req-test",
    }


class StaticKeySource:
    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        return SIGNING_JWK


def settings_for(**overrides: Any) -> Settings:
    return Settings(_env_file=None, **overrides)


def build_app(
    *, settings: Settings | None = None, provider: AiProvider | None = None
) -> FastAPI:
    app = create_app(settings or settings_for())
    if provider is not None:
        runtime = replace(app.state.runtime, provider=provider)
        app.dependency_overrides[get_runtime] = lambda: runtime
    app.dependency_overrides[get_key_source] = StaticKeySource
    return app


def client_of(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://ai.test"
    )


async def post_as_worker(
    path: str,
    body: Any,
    *,
    app: FastAPI | None = None,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    async with client_of(app or build_app()) as client:
        return await client.post(
            path,
            json=body,
            headers=auth_headers() if headers is None else headers,
        )


async def post_completion(
    body: Any = VACANCY_BODY,
    *,
    app: FastAPI | None = None,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    return await post_as_worker(COMPLETE_PATH, body, app=app, headers=headers)


VACANCY_PROMPT = "<vacancy_text>\nAcme\n</vacancy_text>"

COMPLETION_REQUEST = CompletionRequest(
    kind="vacancy_parse",
    system="Extract the vacancy.",
    messages=[Message(role="user", content=VACANCY_PROMPT)],
    output_schema={"type": "object"},
    temperature=0.0,
    max_tokens=64,
)

SCAN_PROMPT = "The resume is in the attached page images."
SCAN_PAGES = (RESUME_PAGE, "/9j/second")
SCAN_REQUEST = replace(
    COMPLETION_REQUEST,
    messages=[Message(role="user", content=SCAN_PROMPT, images=SCAN_PAGES)],
)

VENDOR = VendorSettings(
    api_key="test-key",
    model="test-model",
    embedding_model="test-embed",
    base_url=None,
    timeout_seconds=5,
    max_retries=2,
    vision_model="test-vision",
)


def vendor_settings(**overrides: Any) -> VendorSettings:
    return replace(VENDOR, **overrides)


def retry_soon(status: int) -> httpx2.Response:
    return httpx2.Response(
        status,
        headers={"retry-after-ms": "1"},
        json={"error": {"message": "vendor body"}},
    )


@dataclass
class ScriptedVendor:
    responses: list[httpx2.Response]
    seen: list[httpx2.Request] = field(default_factory=list)

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        self.seen.append(request)
        return self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]

    def client(self) -> httpx2.AsyncClient:
        return httpx2.AsyncClient(transport=httpx2.MockTransport(self.handle))

    def bodies(self) -> list[Any]:
        return [json.loads(request.content) for request in self.seen]


def chat_completion(content: str) -> httpx2.Response:
    return httpx2.Response(
        200,
        json={
            "id": "chatcmpl-1",
            "object": "chat.completion",
            "created": 0,
            "model": "test-model",
            "choices": [
                {
                    "index": 0,
                    "finish_reason": "stop",
                    "message": {"role": "assistant", "content": content},
                }
            ],
            "usage": {"prompt_tokens": 11, "completion_tokens": 7, "total_tokens": 18},
        },
    )


def anthropic_message(tool_input: dict[str, Any]) -> httpx2.Response:
    return httpx2.Response(
        200,
        json={
            "id": "msg_1",
            "type": "message",
            "role": "assistant",
            "model": "test-model",
            "content": [
                {
                    "type": "tool_use",
                    "id": "toolu_1",
                    "name": "submit_vacancy_parse",
                    "input": tool_input,
                }
            ],
            "stop_reason": "tool_use",
            "stop_sequence": None,
            "usage": {"input_tokens": 11, "output_tokens": 7},
        },
    )
