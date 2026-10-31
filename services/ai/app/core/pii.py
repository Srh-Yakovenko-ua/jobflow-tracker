import re

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")

PHONE = re.compile(
    r"(?<![\w+])(?:"
    r"\+\d{1,3}(?:[ .-]?\(?\d{1,4}\)?){2,6}"
    r"|\(?0\d{2}\)?[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}"
    r"|\d{3}[ .-]\d{3}[ .-]\d{4}"
    r")(?!\d)"
)


def scrub(text: str) -> str:
    return PHONE.sub("[phone]", EMAIL.sub("[email]", text))
