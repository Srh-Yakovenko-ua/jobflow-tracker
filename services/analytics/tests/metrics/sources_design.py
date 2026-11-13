from typing import NamedTuple

import pandas as pd

from tests.factories import ApplicationSource, application, application_sources_frame
from tests.metrics.sankey_fixtures import dated_frame

EASY_APPLY = "https://www.linkedin.com/jobs/view/4012345678/apply/?openSEOJobApply=1"
JOB_PAGE = "https://www.linkedin.com/jobs/view/4012345679/"
GHOST_DAY = 21
REASONS = {"rejected": "skills_gap"}


class Cohort(NamedTuple):
    source: str
    to_stage: str
    count: int
    day: float
    url: str | None = None


DESIGN_COHORTS = [
    Cohort("djinni", "screening", 9, 3),
    Cohort("djinni", "rejected", 2, 4),
    Cohort("djinni", "rejected", 11, 8),
    Cohort("djinni", "ghosted", 2, GHOST_DAY),
    Cohort("linkedin", "screening", 2, 9, JOB_PAGE),
    Cohort("linkedin", "rejected", 2, 10, JOB_PAGE),
    Cohort("linkedin", "rejected", 2, 10, EASY_APPLY),
    Cohort("linkedin", "rejected", 6, 14),
    Cohort("linkedin", "ghosted", 4, GHOST_DAY, EASY_APPLY),
    Cohort("dou", "screening", 2, 1.5),
    Cohort("dou", "rejected", 9, 2.5),
    Cohort("referral", "screening", 3, 2),
    Cohort("company_site", "screening", 1, 5),
    Cohort("company_site", "rejected", 1, 6),
]


def applications() -> list[Cohort]:
    return [cohort for cohort in DESIGN_COHORTS for _ in range(cohort.count)]


def design_events() -> pd.DataFrame:
    return dated_frame(
        [
            [
                ("applied", None, 0),
                (cohort.to_stage, REASONS.get(cohort.to_stage), cohort.day),
            ]
            for cohort in applications()
        ]
    )


def design_origins() -> pd.DataFrame:
    return application_sources_frame(
        [
            ApplicationSource(application(index), cohort.source, cohort.url)
            for index, cohort in enumerate(applications())
        ]
    )
