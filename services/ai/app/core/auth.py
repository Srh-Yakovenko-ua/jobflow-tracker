from typing import Annotated, Protocol

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings
from app.core.errors import AppError

BEARER = HTTPBearer(auto_error=False)

SERVICE_ISSUER = "jobflow-api"
SERVICE_AUDIENCE = "jobflow-ai"
SERVICE_SCOPE = "ai:invoke"
REQUIRED_CLAIMS = ["exp", "iat", "iss", "aud", "sub", "scope"]


class SigningKeySource(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK: ...


def key_source_for(settings: Settings) -> SigningKeySource:
    return jwt.PyJWKClient(
        settings.api_jwks_url,
        cache_jwk_set=True,
        lifespan=300,
        timeout=settings.jwks_timeout_seconds,
    )


def get_key_source(request: Request) -> SigningKeySource:
    source: SigningKeySource = request.app.state.key_source
    return source


def signing_key_for(token: str, source: SigningKeySource) -> jwt.PyJWK:
    try:
        return source.get_signing_key_from_jwt(token)
    except jwt.PyJWKClientConnectionError as error:
        raise AppError(
            503, detail="The API signing keys could not be fetched"
        ) from error
    except jwt.PyJWTError as error:
        raise AppError(401) from error


def require_service_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(BEARER)],
    source: Annotated[SigningKeySource, Depends(get_key_source)],
) -> None:
    if credentials is None:
        raise AppError(401)
    token = credentials.credentials
    try:
        claims = jwt.decode(
            token,
            signing_key_for(token, source),
            algorithms=["RS256"],
            audience=SERVICE_AUDIENCE,
            issuer=SERVICE_ISSUER,
            options={"require": REQUIRED_CLAIMS},
        )
    except jwt.PyJWTError as error:
        raise AppError(401) from error
    if claims["scope"] != SERVICE_SCOPE:
        raise AppError(403)
