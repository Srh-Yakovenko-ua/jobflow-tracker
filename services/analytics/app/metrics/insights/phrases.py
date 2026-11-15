from collections.abc import Mapping
from math import ceil, floor
from typing import Final, NamedTuple

from app.metrics.plurals import DAY_FORMS, WEEK_FORMS, counted_uk, plural_uk

DAYS_IN_WEEK: Final = 7


class StagePhrase(NamedTuple):
    name: str
    at: str
    next: str


class SourcePhrase(NamedTuple):
    name: str
    eats: str


STAGE_PHRASES: Final[Mapping[str, StagePhrase]] = {
    "applied": StagePhrase("відгук", "на етапі відгуку", "наступного відгуку"),
    "screening": StagePhrase("скринінг", "на скринінгу", "наступного скринінгу"),
    "tech_interview": StagePhrase(
        "техінтерв'ю", "на техінтерв'ю", "наступного техінтерв'ю"
    ),
    "final": StagePhrase(
        "фінальна співбесіда",
        "на фінальній співбесіді",
        "наступної фінальної співбесіди",
    ),
    "offer": StagePhrase("офер", "на офері", "наступного оферу"),
}

LEAN_ON_SOURCE_TITLES: Final[Mapping[str, str]] = {
    "referral": "Попросити ще кілька рефералок",
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


class TopicPhrase(NamedTuple):
    title: str
    mention: str


TOPIC_PHRASES: Final[Mapping[str, TopicPhrase]] = {
    "algorithms": TopicPhrase("тебе валять алгоритми", "live-coding"),
    "dp": TopicPhrase("тебе валить динамічне програмування", "DP"),
    "system_design": TopicPhrase("тебе валить system design", "system design"),
    "english": TopicPhrase("тебе валить англійська", "англійську"),
    "take_home": TopicPhrase("тебе валять тестові завдання", "тестове завдання"),
    "react_internals": TopicPhrase("тебе валить React під капотом", "React internals"),
    "sql": TopicPhrase("тебе валить SQL", "SQL"),
    "behavioural": TopicPhrase(
        "тебе валять поведінкові питання", "поведінкові питання"
    ),
}

ALL_NOTES_WORDS: Final[Mapping[int, str]] = {3: "три", 4: "чотири"}


def noted_by(mentions: int, *, notes: int) -> str:
    if mentions < notes:
        return f"{mentions} із {notes}"
    return f"усі {ALL_NOTES_WORDS.get(notes, str(notes))}"


def percent(value: float) -> int:
    return round(value * 100)


def dollars(value: int) -> str:
    return "$" + f"{value:,}".replace(",", "\N{NO-BREAK SPACE}")


def sentence(text: str) -> str:
    return text[:1].upper() + text[1:]


def whole_weeks(value: float) -> int:
    return max(1, floor(value + 0.5))


def spent_time(days: float) -> str:
    if days < DAYS_IN_WEEK:
        return counted_uk(round(days), DAY_FORMS)
    low = floor(days / DAYS_IN_WEEK)
    high = ceil(days / DAYS_IN_WEEK)
    if low == high:
        return counted_uk(high, WEEK_FORMS)
    return f"{low}–{high} {plural_uk(high, WEEK_FORMS)}"
