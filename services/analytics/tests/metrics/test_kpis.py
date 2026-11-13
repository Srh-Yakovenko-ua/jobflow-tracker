from datetime import datetime

import pytest

from app.metrics.data_rules import clean_events
from app.metrics.journeys import journeys
from app.metrics.kpis import FunnelKpis, MonthlyCount, SearchPeriod, kpis
from tests.factories import TimedMove, timed_frame

at = datetime.fromisoformat

KYIV_SEARCH = SearchPeriod(started_at=at("2026-06-01T09:00Z"), timezone="Europe/Kyiv")
MID_AUGUST = at("2026-08-15T12:00Z")


def kpis_of(
    paths: list[list[TimedMove]], *, period: SearchPeriod, now: datetime
) -> FunnelKpis:
    return kpis(journeys(clean_events(timed_frame(paths))), period=period, now=now)


def counted(counts: tuple[int, int, int]) -> MonthlyCount:
    total, this_month, previous_month = counts
    return MonthlyCount(
        total=total, this_month=this_month, previous_month=previous_month
    )


@pytest.mark.parametrize(
    ("timezone", "sent"),
    [("Europe/Kyiv", counted((2, 1, 1))), ("UTC", counted((2, 0, 2)))],
)
def test_an_application_sent_late_on_july_31_counts_in_august_in_kyiv(
    timezone: str, sent: MonthlyCount
) -> None:
    paths = [
        [("applied", at("2026-07-31T22:30Z"))],
        [("applied", at("2026-07-10T10:00Z"))],
    ]
    period = KYIV_SEARCH.model_copy(update={"timezone": timezone})

    assert kpis_of(paths, period=period, now=MID_AUGUST).sent == sent


def test_counts_interviews_and_offers_by_the_month_they_were_reached() -> None:
    paths = [
        [
            ("applied", at("2026-07-10T10:00Z")),
            ("screening", at("2026-07-20T10:00Z")),
            ("tech_interview", at("2026-08-02T10:00Z")),
            ("final", at("2026-08-05T10:00Z")),
            ("offer", at("2026-08-10T10:00Z")),
        ],
        [
            ("applied", at("2026-07-01T10:00Z")),
            ("screening", at("2026-07-02T10:00Z")),
            ("offer", at("2026-07-30T10:00Z")),
        ],
        [("applied", at("2026-08-01T10:00Z")), ("screening", at("2026-08-03T10:00Z"))],
    ]

    result = kpis_of(paths, period=KYIV_SEARCH, now=MID_AUGUST)

    assert (result.sent, result.interviews, result.offers) == (
        counted((3, 1, 2)),
        counted((1, 1, 0)),
        counted((2, 1, 1)),
    )


def test_a_skip_from_screening_to_offer_is_not_an_interview() -> None:
    paths = [
        [
            ("applied", at("2026-07-01T10:00Z")),
            ("screening", at("2026-07-02T10:00Z")),
            ("offer", at("2026-08-03T10:00Z")),
        ]
    ]

    result = kpis_of(paths, period=KYIV_SEARCH, now=MID_AUGUST)

    assert (result.interviews, result.offers) == (
        counted((0, 0, 0)),
        counted((1, 1, 0)),
    )


@pytest.mark.parametrize(
    ("end", "days"),
    [
        ((at("2026-07-01T09:00Z"), MID_AUGUST), 30),
        ((None, at("2026-06-11T08:59Z")), 9),
    ],
    ids=["finished search", "open search"],
)
def test_counts_whole_days_in_search_until_it_finished_or_now(
    end: tuple[datetime | None, datetime], days: int
) -> None:
    finished_at, now = end
    period = KYIV_SEARCH.model_copy(update={"finished_at": finished_at})

    assert kpis_of([], period=period, now=now).days_in_search == days


def test_a_january_month_compares_with_december_of_the_year_before() -> None:
    paths = [
        [("applied", at(moment))]
        for moment in (
            "2025-01-15T10:00Z",
            "2025-12-20T10:00Z",
            "2026-01-05T10:00Z",
            "2026-01-06T10:00Z",
        )
    ]

    result = kpis_of(paths, period=KYIV_SEARCH, now=at("2026-01-10T12:00Z"))

    assert result.sent == counted((4, 2, 1))


def test_dumps_to_the_camel_case_keys_of_the_shared_contract() -> None:
    dumped = kpis_of([], period=KYIV_SEARCH, now=MID_AUGUST).model_dump(by_alias=True)

    assert dumped == {
        "sent": {"total": 0, "thisMonth": 0, "previousMonth": 0},
        "interviews": {"total": 0, "thisMonth": 0, "previousMonth": 0},
        "offers": {"total": 0, "thisMonth": 0, "previousMonth": 0},
        "daysInSearch": 75,
    }
