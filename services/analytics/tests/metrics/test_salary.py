from typing import Any

from tests.factories import (
    SalaryRow,
    StageEvent,
    application,
    moves,
    stage_event,
)
from tests.metrics.salary_fixtures import SCREENED, salary_of


def screened(count: int) -> list[StageEvent]:
    return [
        event for index in range(count) for event in moves(application(index), SCREENED)
    ]


def salary_body(events: list[StageEvent], rows: list[SalaryRow]) -> dict[str, Any]:
    return salary_of(events, rows=rows).model_dump(by_alias=True)


def group(
    key: str, *, applications: int, low: int, median: int, high: int
) -> dict[str, Any]:
    return {
        "key": key,
        "applications": applications,
        "low": low,
        "median": median,
        "high": high,
    }


def test_mixed_uah_usd_eur_and_gross_salaries_give_one_usd_range() -> None:
    rows = [
        SalaryRow(application(0), 4500, 4500, salary_tax="net"),
        SalaryRow(application(1), 186750, 186750, currency="UAH", salary_tax="net"),
        SalaryRow(application(2), 3870, None, currency="EUR"),
        SalaryRow(application(3), None, 5844, salary_tax="gross"),
    ]

    body = salary_body(screened(4), rows)

    assert (body["withSalary"], body["median"], body["outcomes"]) == (
        4,
        4500,
        [group("other", applications=4, low=4500, median=4500, high=4500)],
    )


def test_counts_missing_and_unconverted_salaries_outside_every_range() -> None:
    rows = [
        SalaryRow(application(0), 3000, 5000),
        SalaryRow(application(1), None, None),
        SalaryRow(application(2), 20000, 25000, currency="PLN"),
        SalaryRow(application(3), 3000, None, currency=None),
    ]

    body = salary_body(screened(4), rows)

    assert (body["withSalary"], body["missing"], body["unconverted"]) == (1, 1, 2)
    assert body["outcomes"] == [
        group("other", applications=1, low=3000, median=4000, high=5000)
    ]


def test_a_salary_reason_outranks_a_reached_offer() -> None:
    declined, offered, rejected = application(0), application(1), application(2)
    events = [
        *moves(declined, [*SCREENED, "offer"]),
        stage_event(declined, "withdrawn", from_stage="offer", reason="low_salary"),
        *moves(offered, [*SCREENED, "offer"]),
        *moves(rejected, SCREENED),
        stage_event(rejected, "rejected", from_stage="screening", reason="skills_gap"),
    ]
    rows = [
        SalaryRow(declined, 3000, 3600),
        SalaryRow(offered, 6000, None),
        SalaryRow(rejected, 4000, 5000),
    ]

    assert salary_body(events, rows)["outcomes"] == [
        group("offer", applications=1, low=6000, median=6000, high=6000),
        group("salary_rejection", applications=1, low=3000, median=3300, high=3600),
        group("other", applications=1, low=4000, median=4500, high=5000),
    ]


def test_an_application_without_events_counts_as_other() -> None:
    rows = [SalaryRow(application(0), 4000, 4000)]

    assert salary_body([], rows)["outcomes"] == [
        group("other", applications=1, low=4000, median=4000, high=4000)
    ]


def test_groups_seniority_in_the_shared_order_and_skips_an_unknown_one() -> None:
    rows = [
        SalaryRow(application(0), 6000, 7000, seniority="senior"),
        SalaryRow(application(1), 4000, 5000, seniority="middle"),
        SalaryRow(application(2), 3000, 3000),
        SalaryRow(application(3), 4400, None, seniority="middle"),
    ]

    assert salary_body(screened(4), rows)["seniority"] == [
        group("middle", applications=2, low=4000, median=4450, high=5000),
        group("senior", applications=1, low=6000, median=6500, high=7000),
    ]


def test_keeps_the_five_most_common_stack_items_then_by_name() -> None:
    stacks = [
        ("React", "TypeScript"),
        ("React", "TypeScript", "Vue"),
        ("React", "Go"),
        ("Svelte", "Angular"),
        (),
    ]
    rows = [
        SalaryRow(application(index), 1000 * (index + 1), None, stack=stack)
        for index, stack in enumerate(stacks)
    ]

    stack = salary_body(screened(5), rows)["stack"]

    assert [found["key"] for found in stack] == [
        "React",
        "TypeScript",
        "Angular",
        "Go",
        "Svelte",
    ]
    assert stack[0] == group("React", applications=3, low=1000, median=2000, high=3000)


def test_no_salary_gives_empty_groups_and_no_median() -> None:
    body = salary_body([], [])

    assert body == {
        "withSalary": 0,
        "missing": 0,
        "unconverted": 0,
        "median": None,
        "outcomes": [],
        "seniority": [],
        "stack": [],
        "floor": None,
    }
