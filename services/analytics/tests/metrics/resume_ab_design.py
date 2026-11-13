from typing import Final, NamedTuple
from uuid import UUID, uuid5

import pandas as pd

from tests.factories import USER_ID, VersionLink, application, version_links_frame
from tests.metrics.sankey_fixtures import dated_frame

SWITCH_DAY: Final = 30
REPLY_DAYS: Final = 3
TITLES: Final = {1: "хронологічне", 2: "акцент на продукті", 3: "для дизайн-ролей"}


class Cohort(NamedTuple):
    number: int
    to_stage: str
    count: int
    start: float


DESIGN_COHORTS: Final = [
    Cohort(1, "screening", 5, 0),
    Cohort(1, "rejected", 16, 0),
    Cohort(2, "screening", 11, SWITCH_DAY),
    Cohort(2, "rejected", 16, SWITCH_DAY),
    Cohort(3, "screening", 1, SWITCH_DAY + 10),
    Cohort(3, "rejected", 2, SWITCH_DAY + 10),
]


def resume_version(number: int) -> UUID:
    return uuid5(USER_ID, f"resume-version-{number}")


def expanded(cohorts: list[Cohort]) -> list[Cohort]:
    return [cohort for cohort in cohorts for _ in range(cohort.count)]


def ab_events(cohorts: list[Cohort]) -> pd.DataFrame:
    return dated_frame(
        [
            [
                ("applied", None, cohort.start),
                (cohort.to_stage, None, cohort.start + REPLY_DAYS),
            ]
            for cohort in expanded(cohorts)
        ]
    )


def ab_links(cohorts: list[Cohort]) -> pd.DataFrame:
    return version_links_frame(
        [
            VersionLink(
                application(index),
                resume_version(cohort.number),
                cohort.number,
                TITLES[cohort.number],
            )
            for index, cohort in enumerate(expanded(cohorts))
        ]
    )


def design_events() -> pd.DataFrame:
    return ab_events(DESIGN_COHORTS)


def design_links() -> pd.DataFrame:
    return ab_links(DESIGN_COHORTS)
