from typing import Final, NamedTuple


class PluralForms(NamedTuple):
    one: str
    few: str
    many: str


APPLICATION_FORMS: Final = PluralForms("відгук", "відгуки", "відгуків")
COMPANY_FORMS: Final = PluralForms("компанія", "компанії", "компаній")
REJECTION_FORMS: Final = PluralForms("відмова", "відмови", "відмов")
OF_REJECTIONS_FORMS: Final = PluralForms("відмови", "відмов", "відмов")
SILENCE_FORMS: Final = PluralForms("тиша", "тиші", "тиш")
SCREENING_FORMS: Final = PluralForms("скринінг", "скринінги", "скринінгів")
DAY_FORMS: Final = PluralForms("день", "дні", "днів")
WEEK_FORMS: Final = PluralForms("тиждень", "тижні", "тижнів")
NO_REPLY_FORMS: Final = PluralForms("не відповіла", "не відповіли", "не відповіли")
GAVE_FORMS: Final = PluralForms("дав", "дали", "дали")


def plural_uk(count: int, forms: PluralForms) -> str:
    if count % 10 == 1 and count % 100 != 11:
        return forms.one
    if count % 10 in range(2, 5) and count % 100 not in range(12, 15):
        return forms.few
    return forms.many


def counted_uk(count: int, forms: PluralForms) -> str:
    return f"{count} {plural_uk(count, forms)}"
