from typing import Annotated, Any, Protocol
from uuid import UUID

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import DEPENDENCY_LIMITS, Settings
from app.core.errors import TOKEN_EXPIRED, ServiceError

READ_SCOPE = "analytics:read"
ACCESS_TOKEN_CLAIMS = ["exp", "sub", "jti", "scope"]
KEY_SET_LIFESPAN_SECONDS = 300
UNKNOWN_KID_REFETCH_COOLDOWN_SECONDS = 0
KEYS_UNREACHABLE = "The API signing keys could not be fetched"

bearer_scheme = HTTPBearer(auto_error=False)


class KeySource(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK: ...


def key_source_for(settings: Settings) -> KeySource:
    return jwt.PyJWKClient(
        settings.jwks_url,
        cache_jwk_set=True,
        lifespan=KEY_SET_LIFESPAN_SECONDS,
        timeout=DEPENDENCY_LIMITS.connect,
        cooldown_duration=UNKNOWN_KID_REFETCH_COOLDOWN_SECONDS,
    )


def get_key_source(request: Request) -> KeySource:
    key_source: KeySource = request.app.state.key_source
    return key_source


def access_claims(token: str, key_source: KeySource) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            key_source.get_signing_key_from_jwt(token),
            algorithms=["RS256"],
            options={"require": ACCESS_TOKEN_CLAIMS},
        )
    except jwt.PyJWKClientConnectionError as error:
        raise ServiceError(503, detail=KEYS_UNREACHABLE) from error
    except jwt.ExpiredSignatureError as error:
        raise ServiceError(401, problem=TOKEN_EXPIRED) from error
    except jwt.PyJWTError as error:
        raise ServiceError(401) from error


def user_id_from(subject: object) -> UUID:
    try:
        return UUID(str(subject))
    except ValueError as error:
        raise ServiceError(401) from error


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    key_source: Annotated[KeySource, Depends(get_key_source)],
) -> UUID:
    if credentials is None:
        raise ServiceError(401)
    claims = access_claims(credentials.credentials, key_source)
    user_id = user_id_from(claims["sub"])
    if READ_SCOPE not in str(claims["scope"]).split(" "):
        raise ServiceError(403)
    return user_id


CurrentUserId = Annotated[UUID, Depends(current_user)]
