from typing import Any
from uuid import uuid4

import httpx2

from app.core.config import Settings
from tests.factories import bearer

API_TIMEOUT_SECONDS = 10


def api_url(settings: Settings, path: str) -> str:
    return settings.api_url.rstrip("/") + "/api/v1" + path


def register(settings: Settings) -> Any:
    response = httpx2.post(
        api_url(settings, "/auth/register"),
        json={
            "email": f"analytics-{uuid4()}@example.com",
            "password": "analytics-password",
        },
        timeout=API_TIMEOUT_SECONDS,
    )
    assert response.status_code == 201
    return response.json()


def api_call(settings: Settings, *, token: str, request: tuple[str, str, Any]) -> Any:
    method, path, body = request
    response = httpx2.request(
        method,
        api_url(settings, path),
        json=body,
        headers=bearer(token),
        timeout=API_TIMEOUT_SECONDS,
    )
    assert response.is_success, response.text
    return response.json()
