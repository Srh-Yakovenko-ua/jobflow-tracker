import pytest

from app.core.enums import load_domain_enums, progress_stages
from app.metrics.insights.phrases import (
    REASON_TITLES,
    SOURCE_PHRASES,
    STAGE_PHRASES,
    percent,
    sentence,
    spent_time,
)
from app.metrics.reason_tallies import stated_sides


def test_every_progress_stage_has_its_phrase_and_nothing_else() -> None:
    assert tuple(STAGE_PHRASES) == progress_stages()


def test_every_source_has_its_phrase_and_nothing_else() -> None:
    assert tuple(SOURCE_PHRASES) == load_domain_enums().sources


def test_every_stated_side_has_its_reason_title_and_nothing_else() -> None:
    assert tuple(REASON_TITLES) == stated_sides()


def test_a_company_reason_title_names_the_stage_and_the_label() -> None:
    title = REASON_TITLES["company"].format(
        at=STAGE_PHRASES["tech_interview"].at, label="не вистачає скілів"
    )

    assert sentence(title) == (
        "На техінтерв'ю тебе найчастіше валять: «не вистачає скілів»"
    )


def test_a_sentence_capitalises_only_its_first_letter() -> None:
    assert sentence("техінтерв'ю — найдорожчий етап") == (
        "Техінтерв'ю — найдорожчий етап"
    )


@pytest.mark.parametrize(
    ("value", "rounded"),
    [(0.3148, 31), (0.2381, 24), (0.4074, 41), (0.005, 0), (1.0, 100)],
)
def test_percent_rounds_a_share_to_whole_points(value: float, rounded: int) -> None:
    assert percent(value) == rounded


@pytest.mark.parametrize(
    ("days", "spent"),
    [
        (1.0, "1 день"),
        (3.4, "3 дні"),
        (6.0, "6 днів"),
        (7.0, "1 тиждень"),
        (14.0, "2 тижні"),
        (17.0, "2–3 тижні"),
        (31.0, "4–5 тижнів"),
        (35.0, "5 тижнів"),
    ],
)
def test_spent_time_names_days_under_a_week_and_a_week_range_above(
    days: float, spent: str
) -> None:
    assert spent_time(days) == spent
