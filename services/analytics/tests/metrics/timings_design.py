from itertools import accumulate
from typing import Any

import pandas as pd

from tests.factories import TimedMove, day, followups_frame, timed_frame

DESIGN_STAYS = {
    "applied": (2, 3, 4, 6, 8),
    "screening": (5, 6, 7, 10, 12),
    "tech_interview": (6, 8, 9, 12, 13),
    "final": (13, 15, 17, 21, 24),
}
DESIGN_PATH = (*DESIGN_STAYS, "offer")

DESIGN_NORMS_BODY: dict[str, Any] = {
    "stageNormDays": {"applied": 4, "screening": 7, "tech_interview": 9, "final": 17},
    "medianDaysToOffer": 37,
}

DESIGN_TIMINGS_BODY: dict[str, Any] = {
    "stages": [
        {
            "status": "ok",
            "stage": "applied",
            "medianDays": 4.0,
            "lowerQuartileDays": 3.0,
            "upperQuartileDays": 6.0,
            "samples": 5,
        },
        {
            "status": "ok",
            "stage": "screening",
            "medianDays": 7.0,
            "lowerQuartileDays": 6.0,
            "upperQuartileDays": 10.0,
            "samples": 5,
        },
        {
            "status": "ok",
            "stage": "tech_interview",
            "medianDays": 9.0,
            "lowerQuartileDays": 8.0,
            "upperQuartileDays": 12.0,
            "samples": 5,
        },
        {
            "status": "ok",
            "stage": "final",
            "medianDays": 17.0,
            "lowerQuartileDays": 15.0,
            "upperQuartileDays": 21.0,
            "samples": 5,
        },
    ],
    "responseTime": {"status": "ok", "hours": 96.0, "samples": 5},
    "medianDaysToOffer": {"status": "ok", "days": 37.0, "samples": 5},
    "ghostRate": {
        "rate": {
            "status": "ok",
            "value": 0.0,
            "low": 0.0,
            "high": 0.4344824647831746,
            "successes": 0,
            "trials": 5,
        },
        "market": {
            "low": 0.18,
            "high": 0.22,
            "source": (
                "Greenhouse platform data, 2024: 18 to 22% of jobs posted on"
                " Greenhouse in a quarter are ghost jobs"
            ),
            "url": "https://www.entrepreneur.com/business-news/ghost-job-listings-on-the-rise-how-to-spot-avoid-experts/485494",
        },
        "gap": {"position": "below", "points": 18},
    },
}


def design_journey(index: int) -> list[TimedMove]:
    entries = accumulate((stays[index] for stays in DESIGN_STAYS.values()), initial=0)
    return [
        (stage, day(offset)) for stage, offset in zip(DESIGN_PATH, entries, strict=True)
    ]


def design_events() -> pd.DataFrame:
    return timed_frame([design_journey(index) for index in range(5)])


def design_followups() -> pd.DataFrame:
    return followups_frame([])
