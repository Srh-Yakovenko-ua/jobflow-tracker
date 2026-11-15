import socket
from typing import Any

import pandas as pd
import pytest

from app.metrics.insights.engine import insights
from app.metrics.note_topic_stems import TOPIC_STEMS
from app.metrics.note_topics import StageTopics, note_topics, topic_signal
from app.metrics.rate import Rate
from tests.factories import NoteRow, application, notes_frame
from tests.metrics.funnel_design import TECH_INTERVIEW
from tests.metrics.insights_design import design_metrics
from tests.metrics.reasons_design import DESIGN_NOTES, design_frame, design_notes
from tests.metrics.sankey_fixtures import SCREENING, reasoned_frame, rejected_at

TOPIC_SAMPLES = {
    "algorithms": [
        "лайвкодинг",
        "лайв-кодинг на годину",
        "LiveCoding",
        "задача на алгоритми",
        "алгоритмическая задача",
        "Algorithms round",
        "LeetCode medium",
        "літкод",
        "литкод",
    ],
    "dp": [
        "DP на графах",
        "питали дп",
        "динамічне програмування",
        "динамическое программирование",
        "dynamic programming",
    ],
    "system_design": [
        "System-Design інтерв'ю",
        "системний дизайн",
        "системный дизайн",
        "проєктування систем",
        "проектирование систем",
    ],
    "english": ["англійська слабка", "английский", "English level"],
    "take_home": [
        "тестове завдання",
        "тестовое задание",
        "take-home",
        "домашнє завдання",
        "test task",
    ],
    "react_internals": [
        "React internals",
        "reconciliation",
        "virtual DOM",
        "віртуальний DOM",
        "виртуальный DOM",
        "React Fiber",
    ],
    "sql": ["SQL", "запит на sql.", "PostgreSQL", "MySQL"],
    "behavioural": [
        "behavioral",
        "behavioural round",
        "поведінкова співбесіда",
        "поведенческое интервью",
        "soft skills",
        "софт скіли",
    ],
}

UNRELATED_NOTES = [
    "Приємна команда, обговорили релокацію",
    "sqlalchemy, adp, dpi",
    "Engineering manager",
]


def topics_at(stages: tuple[StageTopics, ...], *, stage: str) -> list[Any]:
    found = next(item for item in stages if item.stage == stage)
    return [found.notes, [(topic.topic, topic.mentions) for topic in found.topics]]


def one_rejection_noted(body: str) -> list[Any]:
    events = reasoned_frame(rejected_at(TECH_INTERVIEW, reason="skills_gap", count=1))
    stages = note_topics(events, notes=design_notes((body,)))
    return topics_at(stages, stage="tech_interview")


def test_live_coding_and_an_algorithm_task_are_one_topic() -> None:
    stages = note_topics(design_frame(), notes=design_notes())

    assert topics_at(stages, stage="tech_interview") == [3, [("algorithms", 3)]]


@pytest.mark.parametrize(
    ("topic", "body"),
    [(topic, body) for topic, bodies in TOPIC_SAMPLES.items() for body in bodies],
)
def test_a_note_in_ukrainian_russian_or_english_names_its_topic(
    topic: str, body: str
) -> None:
    assert one_rejection_noted(body) == [1, [(topic, 1)]]


@pytest.mark.parametrize("body", UNRELATED_NOTES)
def test_a_note_without_a_dictionary_word_names_no_topic(body: str) -> None:
    assert one_rejection_noted(body) == [1, []]


def test_the_dictionary_lists_the_eight_interview_topics_in_order() -> None:
    assert tuple(TOPIC_STEMS) == (
        "algorithms",
        "dp",
        "system_design",
        "english",
        "take_home",
        "react_internals",
        "sql",
        "behavioural",
    )


def test_many_notes_on_one_application_count_as_one_mention() -> None:
    chatty = design_notes(("лайвкодинг",)).loc[[0, 0, 0]]
    noted = pd.concat([chatty, design_notes(("", "SQL"))])

    stages = note_topics(design_frame(), notes=noted)

    assert topics_at(stages, stage="tech_interview") == [
        2,
        [("algorithms", 1), ("sql", 1)],
    ]


def test_notes_count_only_at_the_stage_the_application_was_rejected_from() -> None:
    events = reasoned_frame(rejected_at(SCREENING, reason="english_level", count=1))

    stages = note_topics(events, notes=design_notes(("англійська",)))

    assert [topics_at(stages, stage=stage) for stage in ("screening", "applied")] == [
        [1, [("english", 1)]],
        [0, []],
    ]


def test_without_notes_every_stage_has_no_topic() -> None:
    stages = note_topics(design_frame(), notes=notes_frame([]))

    assert [(item.stage, item.notes, item.topics) for item in stages] == [
        ("applied", 0, []),
        ("screening", 0, []),
        ("tech_interview", 0, []),
        ("final", 0, []),
    ]


def test_the_share_is_over_the_noted_rejections_at_the_stage() -> None:
    events = reasoned_frame(rejected_at(SCREENING, reason="english_level", count=6))
    bodies = ("англійська", "English", "англ", "команда", "релокація")

    stages = note_topics(events, notes=design_notes(bodies))
    english = next(item for item in stages if item.stage == "screening").topics[0]

    assert isinstance(english.share, Rate)
    assert (english.topic, english.mentions, english.share.value) == ("english", 3, 0.6)
    assert (english.share.successes, english.share.trials) == (3, 5)


def test_the_signal_needs_three_mentions_of_one_topic() -> None:
    two = note_topics(design_frame(), notes=design_notes(DESIGN_NOTES[:2]))
    three = note_topics(design_frame(), notes=design_notes())

    signal = topic_signal(three, stage="tech_interview")

    assert topic_signal(two, stage="tech_interview") is None
    assert signal is not None
    assert (signal[0].notes, signal[1].topic, signal[1].mentions) == (
        3,
        "algorithms",
        3,
    )


def test_tied_topics_signal_the_first_in_dictionary_order() -> None:
    both = ("SQL і алгоритми",) * 3
    stages = note_topics(design_frame(), notes=design_notes(both))

    signal = topic_signal(stages, stage="tech_interview")

    assert signal is not None
    assert signal[1].topic == "algorithms"


def test_a_stage_without_rejections_gives_no_signal() -> None:
    stages = note_topics(design_frame(), notes=design_notes())

    assert topic_signal(stages, stage="offer") is None


def test_finds_note_topics_without_a_network_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    opened: list[tuple[object, ...]] = []

    def refuse(*args: object, **_: object) -> None:
        opened.append(args)
        raise OSError("a socket was opened while note topics were computed")

    monkeypatch.setattr(socket, "socket", refuse)

    stages = note_topics(design_frame(), notes=design_notes())
    reasons = [
        item for item in insights(design_metrics()).insights if item.block == "reasons"
    ]

    assert topics_at(stages, stage="tech_interview") == [3, [("algorithms", 3)]]
    assert reasons[0].evidence["topic"] == "algorithms"
    assert opened == []


def test_rejections_without_a_note_stay_out_of_the_noted_count() -> None:
    noted = notes_frame([NoteRow(application(3), "алгоритми")])

    stages = note_topics(design_frame(), notes=noted)

    assert topics_at(stages, stage="tech_interview") == [1, [("algorithms", 1)]]
