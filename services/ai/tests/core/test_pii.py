import json
from pathlib import Path
from time import perf_counter

import pytest

from app.core.pii import EMAIL, scrub

VACANCY_CASES = Path(__file__).parents[4] / "apps/api/src/modules/ai/evals/vacancy"


@pytest.mark.parametrize(
    ("text", "scrubbed"),
    [
        ("Write to jane.doe+jobs@example.com.ua today", "Write to [email] today"),
        ("Mail jane.doe+cv@example.co.uk", "Mail [email]"),
        ("Call +380 67 123 45 67, ask for HR", "Call [phone], ask for HR"),
        ("Call +380671234567", "Call [phone]"),
        ("Phone (067) 123-45-67 or 067 123 45 67", "Phone [phone] or [phone]"),
        ("US office 555-123-4567", "US office [phone]"),
        ("Telegram: @olena_dev", "Telegram: [telegram]"),
        (
            "Chat at t.me/olena_dev or https://telegram.me/olena_dev",
            "Chat at [telegram] or [telegram]",
        ),
        ("olena.dev@example.com, @olena_dev", "[email], [telegram]"),
        ("вул. Хрещатик, 22, кв. 5, Київ", "[address], Київ"),
        ("Просп. Перемоги 37/2, Київ", "[address], Київ"),
        ("Office: 12 Baker Street, London", "Office: [address], London"),
        ("221B Baker St., apt. 4", "[address]"),
        (
            "Адреса: м. Львів, вул. Січових Стрільців 5\nДосвід: 5 років",
            "Адреса: [address]\nДосвід: 5 років",
        ),
        ("Address: 7 Elm Lane, Springfield", "Address: [address]"),
    ],
)
def test_replaces_contacts_and_addresses_with_placeholders(
    text: str, scrubbed: str
) -> None:
    assert scrub(text) == scrubbed


@pytest.mark.parametrize(
    "text",
    [
        "Senior React developer, Acme, remote, 4000-5000 USD",
        "Salary 50000-70000 UAH, 2026, 3+ years",
        "Salary 120 000 - 180 000 UAH",
        "C# 5 years",
        "Node.js @ 2026",
        "Stack: React, @tanstack/react-query, @nestjs/core",
        "Провідний розробник, 5 років, St. Petersburg 2026",
    ],
)
def test_keeps_salary_ranges_years_and_tech_names(text: str) -> None:
    assert scrub(text) == text


@pytest.mark.parametrize(
    "text",
    ["a" * 20000, "7" * 20000, "a." * 10000],
    ids=["letters", "digits", "dotted letters"],
)
def test_matches_emails_in_linear_time_on_long_tokens(text: str) -> None:
    started = perf_counter()
    scrubbed = EMAIL.sub("[email]", text)
    elapsed = perf_counter() - started

    assert scrubbed == text
    assert elapsed < 0.1


@pytest.mark.parametrize(
    "case_file", sorted(VACANCY_CASES.glob("*.json")), ids=lambda path: path.name
)
def test_keeps_every_vacancy_eval_case_unchanged(case_file: Path) -> None:
    text = json.loads(case_file.read_text())["text"]

    assert scrub(text) == text
