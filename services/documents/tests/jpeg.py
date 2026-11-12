from io import BytesIO

from PIL import Image


def jpeg_size(jpeg: bytes) -> tuple[int, int]:
    with Image.open(BytesIO(jpeg)) as image:
        return image.size


def jpeg_has_exif(jpeg: bytes) -> bool:
    with Image.open(BytesIO(jpeg)) as image:
        return "exif" in image.info or len(image.getexif()) > 0
