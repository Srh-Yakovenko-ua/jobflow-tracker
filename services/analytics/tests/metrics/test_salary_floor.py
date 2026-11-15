import pytest

from app.metrics.salary_floor import SalaryFloor
from tests.factories import day
from tests.metrics.salary_fixtures import (
    WITHOUT_SALARY,
    floor_events,
    floor_rows,
    salary_of,
)

TWO_REJECTIONS = floor_events(declined_reason="low_salary")


def test_two_salary_rejections_raise_the_floor_above_the_highest_rejected_range() -> (
    None
):
    found = salary_of(TWO_REJECTIONS, rows=floor_rows(offer_high=5800)).floor

    assert found == SalaryFloor(
        floor=4500, rejections=2, below=7, per_month_low=3, per_month_high=4
    )


def test_a_search_shorter_than_a_month_counts_as_one_month() -> None:
    found = salary_of(TWO_REJECTIONS, rows=floor_rows(offer_high=5800), now=day(10))

    assert found.floor is not None
    assert (found.floor.per_month_low, found.floor.per_month_high) == (7, 7)


def test_one_salary_rejection_gives_no_floor() -> None:
    events = floor_events(declined_reason="red_flags")

    assert salary_of(events, rows=floor_rows(offer_high=5800)).floor is None


def test_an_offer_below_the_floor_gives_no_floor() -> None:
    assert salary_of(TWO_REJECTIONS, rows=floor_rows(offer_high=4200)).floor is None


def test_nine_applications_in_scope_give_no_floor() -> None:
    events = [
        event for event in TWO_REJECTIONS if event.application_id != WITHOUT_SALARY
    ]

    assert salary_of(events, rows=floor_rows(offer_high=5800)).floor is None


@pytest.mark.parametrize(
    ("declined_high", "floor"), [(4000, 4500), (4499, 4500), (4500, 5000)]
)
def test_the_floor_is_the_next_500_above_the_highest_rejected_salary(
    declined_high: int, floor: int
) -> None:
    rows = floor_rows(offer_high=5800, declined_high=declined_high)

    found = salary_of(TWO_REJECTIONS, rows=rows).floor

    assert found is not None
    assert found.floor == floor
