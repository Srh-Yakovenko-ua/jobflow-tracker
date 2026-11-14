import multiprocessing
import os
import re
import resource
import sys
import threading
import time
from dataclasses import dataclass
from multiprocessing.connection import Connection
from pathlib import Path
from typing import Literal, cast

import pypdfium2 as pdfium
from pypdfium2 import raw

from app.contracts.document_extraction import Page
from app.core.errors import DocumentError, ErrorType
from app.extract.image import MAX_LONG_SIDE, MAX_PIXELS, to_jpeg_page

SCAN_DPI = 150
POINTS_PER_INCH = 72
MIB = 1024 * 1024
WATCH_SECONDS = 0.02
LINUX_PEAK_KIB = re.compile(r"VmHWM:\s+(\d+) kB")
OVER_LIMITS = "The page could not be rendered within the memory and time limits"


@dataclass(frozen=True)
class RenderLimits:
    memory_bytes: int
    address_space_bytes: int
    seconds: float


RENDER_LIMITS = RenderLimits(
    memory_bytes=512 * MIB, address_space_bytes=4096 * MIB, seconds=6.0
)


@dataclass(frozen=True)
class RenderJob:
    data: bytes
    count: int
    limits: RenderLimits


type Reply = (
    tuple[Literal["pages"], list[Page]] | tuple[Literal["error"], ErrorType, str | None]
)


def check_image_pixels(page: pdfium.PdfPage) -> None:
    images = page.get_objects(filter=[raw.FPDF_PAGEOBJ_IMAGE])
    sizes = (image.get_px_size() for image in images)
    if sum(width * height for width, height in sizes) > MAX_PIXELS:
        raise DocumentError(
            "unreadable_file", detail="The page images have too many pixels"
        )


def render_page(page: pdfium.PdfPage, index: int) -> Page:
    check_image_pixels(page)
    scale = min(SCAN_DPI / POINTS_PER_INCH, MAX_LONG_SIDE / max(page.get_size()))
    bitmap = page.render(scale=scale, draw_annots=False, may_draw_forms=False)
    return to_jpeg_page(bitmap.to_pil(), index)


def peak_rss_bytes() -> int:
    if sys.platform == "linux":
        status = Path("/proc/self/status").read_text()
        return int(LINUX_PEAK_KIB.findall(status)[0]) * 1024
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss


def watch_memory(limit_bytes: int) -> None:
    while peak_rss_bytes() <= limit_bytes:
        time.sleep(WATCH_SECONDS)
    os._exit(1)


def cap_memory(limits: RenderLimits) -> None:
    if sys.platform == "linux":
        cap = limits.address_space_bytes
        resource.setrlimit(resource.RLIMIT_AS, (cap, cap))
    threading.Thread(
        target=watch_memory, args=(limits.memory_bytes,), daemon=True
    ).start()


def render_pages(job: RenderJob) -> list[Page]:
    document = pdfium.PdfDocument(job.data)
    try:
        return [render_page(document[index], index) for index in range(job.count)]
    finally:
        document.close()


def reply_of(job: RenderJob) -> Reply:
    try:
        return ("pages", render_pages(job))
    except DocumentError as error:
        return ("error", error.type, error.detail)
    except pdfium.PdfiumError:
        return ("error", "unreadable_file", None)


def render_child(sender: Connection, job: RenderJob) -> None:
    cap_memory(job.limits)
    reply = reply_of(job)
    if peak_rss_bytes() > job.limits.memory_bytes:
        os._exit(1)
    sender.send(reply)


def over_limits() -> DocumentError:
    return DocumentError("unreadable_file", detail=OVER_LIMITS)


def receive(receiver: Connection, *, seconds: float) -> Reply:
    if not receiver.poll(seconds):
        raise over_limits()
    try:
        return cast(Reply, receiver.recv())
    except EOFError as error:
        raise over_limits() from error


def pages_of(reply: Reply) -> list[Page]:
    if reply[0] == "error":
        raise DocumentError(reply[1], detail=reply[2])
    return reply[1]


def render_scan(
    data: bytes, *, count: int, limits: RenderLimits = RENDER_LIMITS
) -> list[Page]:
    context = multiprocessing.get_context("spawn")
    receiver, sender = context.Pipe(duplex=False)
    job = RenderJob(data=data, count=count, limits=limits)
    child = context.Process(target=render_child, args=(sender, job), daemon=True)
    child.start()
    sender.close()
    try:
        return pages_of(receive(receiver, seconds=limits.seconds))
    finally:
        receiver.close()
        child.kill()
        child.join()
