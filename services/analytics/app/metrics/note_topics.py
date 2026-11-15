import re
from collections.abc import Mapping
from typing import Final

import pandas as pd

from app.core.enums import load_domain_enums, rejectable_stages
from app.metrics.data_rules import clean_events
from app.metrics.note_topic_stems import TOPIC_STEMS
from app.metrics.rate import MetricModel, RateResult, rate
from app.metrics.reason_tallies import rejections_at

NON_WORD_RUN: Final = re.compile(r"[\W_]+")
TOPIC_PATTERNS: Final[Mapping[str, re.Pattern[str]]] = {
    topic: re.compile(rf"(?:^| )(?:{'|'.join(stems)})")
    for topic, stems in TOPIC_STEMS.items()
}


class TopicShare(MetricModel):
    topic: str
    mentions: int
    share: RateResult


class StageTopics(MetricModel):
    stage: str
    notes: int
    topics: list[TopicShare]


def plain_words(text: str) -> str:
    return NON_WORD_RUN.sub(" ", text.casefold())


def noted_texts(notes: pd.DataFrame) -> dict[object, str]:
    joined = notes.groupby("application_id")["body"].agg(" ".join)
    return {application: plain_words(text) for application, text in joined.items()}


def stage_topics(texts: list[str], *, stage: str) -> StageTopics:
    counts = {
        topic: sum(1 for text in texts if pattern.search(text))
        for topic, pattern in TOPIC_PATTERNS.items()
    }
    return StageTopics(
        stage=stage,
        notes=len(texts),
        topics=[
            TopicShare(topic=topic, mentions=count, share=rate(count, len(texts)))
            for topic, count in counts.items()
            if count
        ],
    )


def rejected_texts(
    clean: pd.DataFrame, *, texts: dict[object, str], stage: str
) -> list[str]:
    rejected = rejections_at(clean, stage=stage)["application_id"].unique()
    return [texts[application] for application in rejected if application in texts]


def note_topics(
    events: pd.DataFrame, *, notes: pd.DataFrame
) -> tuple[StageTopics, ...]:
    clean = clean_events(events)
    texts = noted_texts(notes)
    return tuple(
        stage_topics(rejected_texts(clean, texts=texts, stage=stage), stage=stage)
        for stage in rejectable_stages()
    )


def topic_signal(
    stages: tuple[StageTopics, ...], *, stage: str
) -> tuple[StageTopics, TopicShare] | None:
    found = next((item for item in stages if item.stage == stage), None)
    if found is None or not found.topics:
        return None
    strongest = max(found.topics, key=lambda topic: topic.mentions)
    if strongest.mentions < load_domain_enums().thresholds.min_n_note_topic:
        return None
    return found, strongest
