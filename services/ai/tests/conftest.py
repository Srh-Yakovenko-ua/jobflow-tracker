import socket
from collections.abc import Iterator

import pytest

from app.core.config import Settings


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in Settings.model_fields:
        monkeypatch.delenv(name.upper(), raising=False)


@pytest.fixture
def closed_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port: int = probe.getsockname()[1]
    return port


@pytest.fixture
def silent_port() -> Iterator[int]:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        yield listener.getsockname()[1]


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
