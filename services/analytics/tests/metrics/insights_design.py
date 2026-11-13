from typing import Any, Final

import pandas as pd

from app.metrics.data_rules import clean_events
from app.metrics.funnel import funnel_stages
from app.metrics.ghost_market import ghost_rate_vs_market
from app.metrics.insights.engine import InsightMetrics
from app.metrics.insights.inputs import insight_metrics
from app.metrics.journeys import journeys
from app.metrics.most_expensive import most_expensive
from app.metrics.reasons import reasons
from app.metrics.resume_ab import resume_ab
from app.metrics.sources import sources
from tests.factories import ApplicationSource, application_sources_frame
from tests.metrics import (
    funnel_design,
    reasons_design,
    resume_ab_design,
    sources_design,
)

DESIGN_APPLICATIONS: Final = 54

DESIGN_INSIGHTS_BODY: Final[dict[str, list[dict[str, Any]]]] = {
    "insights": [
        {
            "block": "funnel",
            "title": "Найширша втеча — на першому кроці",
            "body": "21 відмова і 14 тиш із 54 — воронка закінчується там, "
            "де ти ще ні з ким не говорив.",
            "severity": "neutral",
            "evidence": {
                "stage": "applied",
                "reached": 54,
                "rejected": 21,
                "ghosted": 14,
            },
        },
        {
            "block": "funnel",
            "title": "Техінтерв'ю — найдорожчий етап",
            "body": "Дійшло 9, пройшло 4. Кожна втрата тут — це 2–3 тижні "
            "вже витраченого часу.",
            "severity": "warning",
            "evidence": {
                "stage": "tech_interview",
                "reached": 9,
                "passed": 4,
                "lost": 5,
                "investedDaysMedian": 17.0,
            },
        },
        {
            "block": "reasons",
            "title": "На техінтерв'ю тебе найчастіше валять: «не вистачає скілів»",
            "body": "3 із 4 відмов на цьому етапі — «не вистачає скілів».",
            "severity": "warning",
            "evidence": {
                "stage": "tech_interview",
                "code": "skills_gap",
                "count": 3,
                "of": 4,
            },
        },
        {
            "block": "sources",
            "title": "LinkedIn з'їдає час, рефералки — ні",
            "body": "16 відгуків через LinkedIn дали 2 скринінги. Djinni при 24 — 9.",
            "severity": "warning",
            "evidence": {
                "weak": "linkedin",
                "weakApplications": 16,
                "weakScreenings": 2,
                "strong": "referral",
                "strongApplications": 3,
                "strongScreenings": 3,
                "comparison": "djinni",
                "comparisonApplications": 24,
                "comparisonScreenings": 9,
            },
        },
        {
            "block": "resume_ab",
            "title": "Схоже, CV v2 працює краще",
            "body": "Після переходу на CV v2 конверсія виросла з 24% до 41%.",
            "severity": "positive",
            "evidence": {
                "challenger": 2,
                "baseline": 1,
                "beforePercent": 24,
                "afterPercent": 41,
            },
        },
        {
            "block": "ghosted",
            "title": "17 компаній не відповіли",
            "body": "Це 31% твоїх відгуків — на 9 п.п. більше за ринок.",
            "severity": "neutral",
            "evidence": {
                "ghosted": 17,
                "applications": 54,
                "sharePercent": 31,
                "position": "above",
                "gapPoints": 9,
            },
        },
    ]
}


def one_source_metrics(
    events: pd.DataFrame, *, source: str, links: pd.DataFrame
) -> InsightMetrics:
    origins = application_sources_frame(
        [
            ApplicationSource(application_id, source)
            for application_id in events["application_id"].unique()
        ]
    )
    return insight_metrics(
        events, origins=origins, links=links, now=reasons_design.DESIGN_NOW
    )


def design_metrics() -> InsightMetrics:
    funnel_events = funnel_design.design_frame()
    rows = journeys(clean_events(funnel_events))
    return InsightMetrics(
        applications=DESIGN_APPLICATIONS,
        stages=funnel_stages(rows),
        most_expensive=most_expensive(rows),
        reasons=reasons(
            reasons_design.design_frame(), stage=None, now=reasons_design.DESIGN_NOW
        ),
        sources=sources(
            sources_design.design_events(), origins=sources_design.design_origins()
        ),
        resume_ab=resume_ab(
            resume_ab_design.design_events(), links=resume_ab_design.design_links()
        ),
        ghosts=ghost_rate_vs_market(funnel_events),
    )
