from typing import Final, NamedTuple


class Tagged(NamedTuple):
    source: str
    version: int
    size: int
    easy_apply: bool = False


URLS: Final = {
    "djinni": "https://djinni.co/jobs/71{number:03d}-frontend-developer/",
    "dou": "https://jobs.dou.ua/companies/acme/vacancies/30{number:03d}/",
    "robota": "https://robota.ua/company/acme/vacancy/104{number:03d}",
    "linkedin": "https://www.linkedin.com/jobs/view/4012345{number:03d}/",
    "referral": "https://careers.acme.example/jobs/{number}?ref=referral",
    "company_site": "https://careers.acme.example/jobs/{number}",
}
EASY_APPLY_URL: Final = (
    "https://www.linkedin.com/jobs/view/4012345{number:03d}/apply/?openSEOJobApply=1"
)
TECH_INTERVIEW_REASONS: Final = (
    "skills_gap",
    "skills_gap",
    "skills_gap",
    "english_level",
)

DESIGN_TAGS: Final[list[tuple[Tagged, ...]]] = [
    (Tagged("djinni", 1, 2),),
    (Tagged("linkedin", 1, 7, easy_apply=True),),
    (Tagged("dou", 2, 1),),
    (Tagged("djinni", 1, 5),),
    (Tagged("linkedin", 2, 2),),
    (Tagged("dou", 2, 1),),
    (Tagged("robota", 1, 1), Tagged("company_site", 1, 1)),
    (Tagged("djinni", 2, 3),),
    (Tagged("djinni", 1, 4), Tagged("dou", 1, 1), Tagged("robota", 2, 2)),
    (Tagged("djinni", 2, 1),),
    (Tagged("referral", 2, 1),),
    (Tagged("referral", 2, 2),),
    (Tagged("company_site", 3, 1),),
    (
        Tagged("djinni", 2, 9),
        Tagged("linkedin", 2, 5),
        Tagged("linkedin", 3, 2),
        Tagged("dou", 3, 3),
    ),
]


def url_of(tagged: Tagged, *, number: int) -> str:
    template = EASY_APPLY_URL if tagged.easy_apply else URLS[tagged.source]
    return template.format(number=number)
