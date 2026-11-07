import re

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")

TELEGRAM = re.compile(
    r"(?<![\w.@])(?:"
    r"(?:https?://)?(?:t|telegram)\.me/[A-Za-z]\w{4,31}(?!\w)"
    r"|@[A-Za-z]\w{4,31}(?![\w/])"
    r")"
)

PHONE = re.compile(
    r"(?<![\w+])(?:"
    r"\+\d{1,3}(?:[ .-]?\(?\d{1,4}\)?){2,6}"
    r"|\(?0\d{2}\)?[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}"
    r"|\d{3}[ .-]\d{3}[ .-]\d{4}"
    r")(?!\d)"
)

ADDRESS_LINE = re.compile(r"(?P<label>(?<!\w)(?i:адреса|address)[ \t]*:[ \t]*)\S[^\n]*")

HOUSE = r"\d+[^\W\d_]?(?:/\d+[^\W\d_]?)?"
STREET_NAME = r"[^\W\d_][\w'’ʼ.-]*(?:[ \t]+[^\W\d_][\w'’ʼ.-]*){0,3}"
STREET = re.compile(
    r"(?<!\w)(?:"
    r"(?i:вул\.|вулиця|просп\.|проспект|бульв\.|бульвар|пров\.|провулок)[ \t]*"
    rf"{STREET_NAME},?[ \t]*(?:(?i:буд\.)[ \t]*)?{HOUSE}"
    rf"|{HOUSE}[ \t]+(?:[A-Z][\w'-]*[ \t]+){{1,3}}"
    r"(?i:street|st\.|avenue|ave\.|road|rd\.)"
    r")(?!\w)(?:,?[ \t]*(?i:кв\.|apt\.?)[ \t]*\d+[^\W\d_]?)?"
)

RULES = (
    (EMAIL, "[email]"),
    (TELEGRAM, "[telegram]"),
    (PHONE, "[phone]"),
    (ADDRESS_LINE, r"\g<label>[address]"),
    (STREET, "[address]"),
)


def scrub(text: str) -> str:
    for pattern, placeholder in RULES:
        text = pattern.sub(placeholder, text)
    return text
