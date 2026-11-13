from collections.abc import Mapping
from math import ceil, floor
from typing import Final, NamedTuple

from app.metrics.plurals import DAY_FORMS, WEEK_FORMS, counted_uk, plural_uk

DAYS_IN_WEEK: Final = 7


class StagePhrase(NamedTuple):
    name: str
    at: str


class SourcePhrase(NamedTuple):
    name: str
    eats: str


STAGE_PHRASES: Final[Mapping[str, StagePhrase]] = {
    "applied": StagePhrase("відгук", "на етапі відгуку"),
    "screening": StagePhrase("скринінг", "на скринінгу"),
    "tech_interview": StagePhrase("техінтерв'ю", "на техінтерв'ю"),
    "final": StagePhrase("фінальна співбесіда", "на фінальній співбесіді"),
    "offer": StagePhrase("офер", "на офері"),
}

SOURCE_PHRASES: Final[Mapping[str, SourcePhrase]] = {
    "djinni": SourcePhrase("Djinni", "з'їдає"),
    "dou": SourcePhrase("DOU", "з'їдає"),
    "robota": SourcePhrase("robota.ua", "з'їдає"),
    "workua": SourcePhrase("Work.ua", "з'їдає"),
    "linkedin": SourcePhrase("LinkedIn", "з'їдає"),
    "referral": SourcePhrase("рефералки", "з'їдають"),
    "company_site": SourcePhrase("сайти компаній", "з'їдають"),
    "other": SourcePhrase("інші джерела", "з'їдають"),
}

REASON_TITLES: Final[Mapping[str, str]] = {
    "company": "{at} тебе найчастіше валять: «{label}»",
    "candidate": "{at} ти найчастіше відмовляєш сам: «{label}»",
}


def percent(value: float) -> int:
    return round(value * 100)


def sentence(text: str) -> str:
    return text[:1].upper() + text[1:]


def spent_time(days: float) -> str:
    if days < DAYS_IN_WEEK:
        return counted_uk(round(days), DAY_FORMS)
    low = floor(days / DAYS_IN_WEEK)
    high = ceil(days / DAYS_IN_WEEK)
    if low == high:
        return counted_uk(high, WEEK_FORMS)
    return f"{low}–{high} {plural_uk(high, WEEK_FORMS)}"
