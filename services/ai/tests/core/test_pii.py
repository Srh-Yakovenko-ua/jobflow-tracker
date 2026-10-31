import pytest

from app.core.pii import scrub


@pytest.mark.parametrize(
    ("text", "scrubbed"),
    [
        ("Write to jane.doe+jobs@example.com.ua today", "Write to [email] today"),
        ("Call +380 67 123 45 67, ask for HR", "Call [phone], ask for HR"),
        ("Call +380671234567", "Call [phone]"),
        ("Phone (067) 123-45-67 or 067 123 45 67", "Phone [phone] or [phone]"),
        ("US office 555-123-4567", "US office [phone]"),
    ],
)
def test_replaces_emails_and_phone_numbers_with_placeholders(
    text: str, scrubbed: str
) -> None:
    assert scrub(text) == scrubbed


@pytest.mark.parametrize(
    "text",
    [
        "Senior React developer, Acme, remote, 4000-5000 USD",
        "Salary 50000-70000 UAH, 2026, 3+ years",
        "Salary 120 000 - 180 000 UAH",
    ],
)
def test_keeps_salary_ranges_and_years(text: str) -> None:
    assert scrub(text) == text
