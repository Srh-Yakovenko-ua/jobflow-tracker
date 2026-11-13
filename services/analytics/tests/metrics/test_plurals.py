import pytest

from app.metrics.plurals import (
    APPLICATION_FORMS,
    COMPANY_FORMS,
    GAVE_FORMS,
    NO_REPLY_FORMS,
    OF_REJECTIONS_FORMS,
    REJECTION_FORMS,
    SCREENING_FORMS,
    SILENCE_FORMS,
    WEEK_FORMS,
    PluralForms,
    counted_uk,
    plural_uk,
)

COUNTS = (1, 2, 5, 11, 21, 22)


@pytest.mark.parametrize(
    ("forms", "words"),
    [
        (
            APPLICATION_FORMS,
            ("відгук", "відгуки", "відгуків", "відгуків", "відгук", "відгуки"),
        ),
        (
            COMPANY_FORMS,
            ("компанія", "компанії", "компаній", "компаній", "компанія", "компанії"),
        ),
        (
            REJECTION_FORMS,
            ("відмова", "відмови", "відмов", "відмов", "відмова", "відмови"),
        ),
        (
            OF_REJECTIONS_FORMS,
            ("відмови", "відмов", "відмов", "відмов", "відмови", "відмов"),
        ),
        (SILENCE_FORMS, ("тиша", "тиші", "тиш", "тиш", "тиша", "тиші")),
        (
            SCREENING_FORMS,
            (
                "скринінг",
                "скринінги",
                "скринінгів",
                "скринінгів",
                "скринінг",
                "скринінги",
            ),
        ),
        (
            WEEK_FORMS,
            ("тиждень", "тижні", "тижнів", "тижнів", "тиждень", "тижні"),
        ),
        (
            NO_REPLY_FORMS,
            (
                "не відповіла",
                "не відповіли",
                "не відповіли",
                "не відповіли",
                "не відповіла",
                "не відповіли",
            ),
        ),
        (GAVE_FORMS, ("дав", "дали", "дали", "дали", "дав", "дали")),
    ],
)
def test_ukrainian_words_agree_with_1_2_5_11_21_and_22(
    forms: PluralForms, words: tuple[str, ...]
) -> None:
    assert tuple(plural_uk(count, forms) for count in COUNTS) == words


@pytest.mark.parametrize(
    ("count", "counted"),
    [
        (12, "12 відгуків"),
        (14, "14 відгуків"),
        (111, "111 відгуків"),
        (0, "0 відгуків"),
        (104, "104 відгуки"),
    ],
)
def test_counted_puts_the_number_before_its_agreeing_word(
    count: int, counted: str
) -> None:
    assert counted_uk(count, APPLICATION_FORMS) == counted
