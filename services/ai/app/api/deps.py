from fastapi import Request

from app.core.structured import Runtime


def get_runtime(request: Request) -> Runtime:
    runtime: Runtime = request.app.state.runtime
    return runtime
