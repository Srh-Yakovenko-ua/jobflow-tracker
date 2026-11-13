import base64
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.contracts.document_extraction import DocumentExtraction, Kind, Page
from app.core.errors import DocumentError
from app.core.limits import LIMITS

MAX_LONG_SIDE = 1600
MIN_LONG_SIDE = 200
MAX_PIXELS = 50_000_000
QUALITY_STEPS = (85, 75, 65, 55, 45, 35)
SHRINK_FACTOR = 0.75


def flatten(image: Image.Image) -> Image.Image:
    if image.mode in {"RGBA", "LA", "PA"} or "transparency" in image.info:
        rgba = image.convert("RGBA")
        white = Image.new("RGB", rgba.size, "white")
        white.paste(rgba, mask=rgba.getchannel("A"))
        return white
    return image.convert("RGB")


def fit_long_side(image: Image.Image, long_side: int) -> Image.Image:
    scale = long_side / max(image.size)
    if scale >= 1:
        return image
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def smallest_jpeg(image: Image.Image) -> bytes | None:
    for quality in QUALITY_STEPS:
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=quality, optimize=True)
        if buffer.tell() <= LIMITS.max_jpeg_bytes:
            return buffer.getvalue()
    return None


def to_jpeg_page(image: Image.Image, index: int) -> Page:
    long_side = MAX_LONG_SIDE
    rgb = flatten(image)
    rgb.info.clear()
    while long_side >= MIN_LONG_SIDE:
        jpeg = smallest_jpeg(fit_long_side(rgb, long_side))
        if jpeg is not None:
            return Page(
                index=index,
                jpeg_base64=base64.b64encode(jpeg).decode("ascii"),
                bytes=len(jpeg),
            )
        long_side = int(min(long_side, max(rgb.size)) * SHRINK_FACTOR)
    raise DocumentError("unreadable_file", detail="The page does not fit the JPEG cap")


def open_image(data: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(data))
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as error:
        raise DocumentError("unreadable_file") from error
    if image.width * image.height > MAX_PIXELS:
        raise DocumentError("unreadable_file", detail="The image has too many pixels")
    return image


def extract_image(data: bytes) -> DocumentExtraction:
    image = open_image(data)
    try:
        image.thumbnail((MAX_LONG_SIDE, MAX_LONG_SIDE))
        upright = ImageOps.exif_transpose(image)
    except (OSError, ValueError, SyntaxError) as error:
        raise DocumentError("unreadable_file") from error
    return DocumentExtraction(
        kind=Kind.scan, text="", pages=[to_jpeg_page(upright, 0)], page_count=1
    )
