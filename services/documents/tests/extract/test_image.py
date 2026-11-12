import base64
from io import BytesIO

import pytest
from PIL import ExifTags, Image

from app.core.errors import DocumentError
from app.extract.image import extract_image
from tests.factories import (
    MAX_JPEG_BYTES,
    noise_png,
    phone_jpeg,
    pixel_bomb_png,
    transparent_png,
)
from tests.jpeg import jpeg_has_exif, jpeg_size


def only_page(data: bytes) -> bytes:
    extraction = extract_image(data)
    assert (extraction.kind.value, extraction.text, extraction.page_count) == (
        "scan",
        "",
        1,
    )
    assert [page.index for page in extraction.pages] == [0]
    jpeg = base64.b64decode(extraction.pages[0].jpeg_base64)
    assert len(jpeg) == extraction.pages[0].bytes <= MAX_JPEG_BYTES
    return jpeg


def test_shrinks_a_noisy_scan_until_it_fits_the_jpeg_cap() -> None:
    assert max(jpeg_size(only_page(noise_png()))) <= 1600


def test_turns_a_phone_photo_upright_and_drops_its_exif() -> None:
    source = phone_jpeg()
    with Image.open(BytesIO(source)) as photo:
        assert ExifTags.IFD.GPSInfo in photo.getexif()

    jpeg = only_page(source)

    assert (jpeg_size(jpeg), jpeg_has_exif(jpeg)) == ((600, 800), False)


def test_refuses_an_image_above_fifty_megapixels() -> None:
    with pytest.raises(DocumentError) as raised:
        extract_image(pixel_bomb_png())

    assert (raised.value.status, raised.value.type) == (422, "unreadable_file")


def test_flattens_a_transparent_png_onto_white() -> None:
    with Image.open(BytesIO(only_page(transparent_png()))) as page:
        assert (page.mode, page.size, page.getpixel((20, 15))) == (
            "RGB",
            (40, 30),
            (255, 255, 255),
        )
