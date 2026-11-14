from collections.abc import Awaitable, Callable
from hashlib import sha256
from typing import Final
from urllib.parse import urlencode
from uuid import UUID

from fastapi import Request, Response
from pydantic import TypeAdapter

from app.services.metric_cache import CacheScope, cached_body

PARAMS_HASH_LENGTH: Final = 16
METRIC_PREFIX: Final = "/analytics/"
REVALIDATE: Final = "private, max-age=0"


def cache_scope(request: Request, *, user_id: UUID) -> CacheScope:
    query = urlencode(sorted(request.query_params.multi_items()))
    return CacheScope(
        user_id=user_id,
        metric=request.url.path.removeprefix(METRIC_PREFIX),
        params_hash=sha256(query.encode()).hexdigest()[:PARAMS_HASH_LENGTH],
    )


def matches(if_none_match: str | None, *, etag: str) -> bool:
    if if_none_match is None:
        return False
    tags = {tag.strip().removeprefix("W/") for tag in if_none_match.split(",")}
    return "*" in tags or etag in tags


async def cached_response[T](
    request: Request,
    *,
    user_id: UUID,
    adapter: TypeAdapter[T],
    compute: Callable[[], Awaitable[T]],
) -> Response:
    body = await cached_body(
        request.app.state.redis,
        scope=cache_scope(request, user_id=user_id),
        adapter=adapter,
        compute=compute,
    )
    etag = f'"{sha256(body).hexdigest()}"'
    headers = {"ETag": etag, "Cache-Control": REVALIDATE}
    if matches(request.headers.get("if-none-match"), etag=etag):
        return Response(status_code=304, headers=headers)
    return Response(body, media_type="application/json", headers=headers)
