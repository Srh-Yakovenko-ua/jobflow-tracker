import multiprocessing
from multiprocessing.connection import Connection
from typing import cast

import pytest
from PIL import Image

from app.core.errors import DocumentError
from app.extract import render_sandbox
from app.extract.render_sandbox import (
    RENDER_LIMITS,
    RenderJob,
    receive,
    render_scan,
    reply_of,
)
from tests.factories import RENDER_REFUSAL, scan_pdf

SPAWN = multiprocessing.get_context("spawn")


class ResetReceiver:
    def poll(self, _seconds: float) -> bool:
        return True

    def recv(self) -> object:
        raise ConnectionResetError


class UnstartableProcess:
    def __init__(self, **_options: object) -> None:
        pass

    def start(self) -> None:
        raise OSError


class UnstartableContext:
    def __init__(self) -> None:
        self.ends: list[Connection] = []

    def Pipe(self, *, duplex: bool) -> tuple[Connection, Connection]:
        ends = SPAWN.Pipe(duplex=duplex)
        self.ends.extend(ends)
        return ends

    Process = UnstartableProcess


def refuse_pixels(*_args: object) -> None:
    raise Image.DecompressionBombError


def test_a_pil_error_in_the_child_replies_unreadable_file(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(render_sandbox, "to_jpeg_page", refuse_pixels)

    reply = reply_of(RenderJob(data=scan_pdf(1), count=1, limits=RENDER_LIMITS))

    assert reply == ("error", "unreadable_file", None)


def fail_page(*_args: object) -> None:
    raise IndexError


def test_any_other_child_error_replies_unreadable_file(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(render_sandbox, "render_page", fail_page)

    reply = reply_of(RenderJob(data=scan_pdf(1), count=1, limits=RENDER_LIMITS))

    assert reply == ("error", "unreadable_file", None)


def test_a_pipe_reset_mid_reply_answers_over_the_limits() -> None:
    with pytest.raises(DocumentError) as raised:
        receive(cast(Connection, ResetReceiver()), seconds=1.0)

    assert (raised.value.type, raised.value.detail) == (
        "unreadable_file",
        RENDER_REFUSAL,
    )


def test_a_failed_child_start_answers_unreadable_file_with_both_ends_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    context = UnstartableContext()
    monkeypatch.setattr(multiprocessing, "get_context", lambda _method: context)

    with pytest.raises(DocumentError) as raised:
        render_scan(scan_pdf(1), count=1)

    assert (raised.value.type, raised.value.detail) == ("unreadable_file", None)
    assert [end.closed for end in context.ends] == [True, True]
