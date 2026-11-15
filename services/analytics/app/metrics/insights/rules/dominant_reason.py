from app.core.enums import CANDIDATE_SIDE, load_domain_enums
from app.metrics.insights.engine import Insight, InsightMetrics, insight_rule
from app.metrics.insights.phrases import (
    REASON_TITLES,
    STAGE_PHRASES,
    TOPIC_PHRASES,
    noted_by,
    sentence,
)
from app.metrics.note_topics import StageTopics, TopicShare, topic_signal
from app.metrics.plurals import OF_REJECTIONS_FORMS, plural_uk
from app.metrics.reasons_trend import TopReason


def with_topic(
    said: Insight, *, signal: tuple[StageTopics, TopicShare], at: str
) -> Insight:
    noted, topic = signal
    phrase = TOPIC_PHRASES[topic.topic]
    who = noted_by(topic.mentions, notes=noted.notes)
    return said.model_copy(
        update={
            "title": sentence(f"{at} {phrase.title}"),
            "body": f"{said.body.removesuffix('.')}, "
            f"і в нотатках {who} згадують {phrase.mention}.",
            "evidence": {
                **said.evidence,
                "topic": topic.topic,
                "topicMentions": topic.mentions,
                "notes": noted.notes,
            },
        }
    )


@insight_rule
def dominant_reason(metrics: InsightMetrics) -> Insight | None:
    top = metrics.reasons.headline
    if not isinstance(top, TopReason):
        return None
    reason = next(
        reason
        for reason in load_domain_enums().rejection_reasons
        if reason.code == top.code
    )
    at = STAGE_PHRASES[top.stage].at
    rejections = plural_uk(top.of, OF_REJECTIONS_FORMS)
    said = Insight(
        block="reasons",
        title=sentence(REASON_TITLES[reason.side].format(at=at, label=reason.label_uk)),
        body=f"{top.count} із {top.of} {rejections} на цьому етапі "
        f"— «{reason.label_uk}».",
        severity="warning",
        evidence={
            "stage": top.stage,
            "code": top.code,
            "count": top.count,
            "of": top.of,
        },
    )
    signal = topic_signal(metrics.note_topics, stage=top.stage)
    if signal is None or reason.side == CANDIDATE_SIDE:
        return said
    return with_topic(said, signal=signal, at=at)
