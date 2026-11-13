from dataclasses import replace

import pytest

from app.metrics.funnel import FunnelStage
from app.metrics.ghost_market import ghost_rate_vs_market
from app.metrics.insights import engine
from app.metrics.insights.engine import Insight, InsightMetrics, insight_rule, insights
from app.metrics.insights.rules.dominant_reason import dominant_reason
from app.metrics.insights.rules.entry_leak import narrowest_step
from app.metrics.insights.rules.ghosts import ghost_share
from app.metrics.insights.rules.resume_switch import resume_switch
from app.metrics.insights.rules.source_gap import weak_and_strong_source
from app.metrics.rate import Insufficient, rate
from app.metrics.reasons import reasons
from app.metrics.reasons_trend import TopReason
from tests.metrics.funnel_design import TECH_INTERVIEW
from tests.metrics.insights_design import design_metrics, one_source_metrics
from tests.metrics.reasons_design import DESIGN_NOW
from tests.metrics.resume_ab_design import Cohort, ab_events, ab_links
from tests.metrics.sankey_fixtures import (
    APPLIED,
    cohort,
    reasoned_frame,
    rejected_at,
)

TINY_COHORTS = [
    Cohort(1, "screening", 1, 0),
    Cohort(1, "rejected", 1, 0),
    Cohort(2, "screening", 1, 30),
    Cohort(2, "rejected", 1, 30),
]


@pytest.fixture(name="metrics")
def design_fixture_metrics() -> InsightMetrics:
    return design_metrics()


def step(stage: str, *, reached: int, passed: int) -> FunnelStage:
    return FunnelStage(
        stage=stage,
        reached=reached,
        passed=passed,
        conversion=rate(passed, reached),
        drop_off={"rejected": reached - passed, "ghosted": 0, "withdrawn": 0},
    )


def tiny_metrics() -> InsightMetrics:
    return one_source_metrics(
        ab_events(TINY_COHORTS), source="linkedin", links=ab_links(TINY_COHORTS)
    )


def test_names_a_later_stage_when_the_funnel_narrows_after_the_entry(
    metrics: InsightMetrics,
) -> None:
    stages = [
        step("applied", reached=20, passed=12),
        step("screening", reached=12, passed=3),
        step("tech_interview", reached=3, passed=1),
    ]

    said = narrowest_step(replace(metrics, stages=stages))

    assert said == Insight(
        block="funnel",
        title="Далі об'єм відгуків уже не допоможе",
        body="Воронка звужується не на вході, а на скринінгу: пройшло 3 із 12.",
        severity="warning",
        evidence={"stage": "screening", "passed": 3, "trials": 12},
    )


def test_says_the_conversion_fell_after_the_switch_as_a_warning(
    metrics: InsightMetrics,
) -> None:
    comparison = metrics.resume_ab.comparison
    assert comparison is not None
    switch = comparison.switch
    fell = switch.model_copy(update={"before": switch.after, "after": switch.before})
    resume_ab = metrics.resume_ab.model_copy(
        update={"comparison": comparison.model_copy(update={"switch": fell})}
    )

    said = resume_switch(replace(metrics, resume_ab=resume_ab))

    assert said is not None
    assert (said.body, said.severity) == (
        "Після переходу на CV v2 конверсія впала з 41% до 24%.",
        "warning",
    )


def test_titles_a_candidate_side_leader_as_your_own_refusal(
    metrics: InsightMetrics,
) -> None:
    top = TopReason(stage="final", code="low_salary", count=5, of=21)
    leading = metrics.reasons.model_copy(update={"headline": top})

    said = dominant_reason(replace(metrics, reasons=leading))

    assert said is not None
    assert (said.title, said.body) == (
        "На фінальній співбесіді ти найчастіше відмовляєш сам: «низька вилка»",
        "5 із 21 відмови на цьому етапі — «низька вилка».",
    )


def test_says_nothing_about_reasons_when_two_lead_with_the_same_count(
    metrics: InsightMetrics,
) -> None:
    tied = reasoned_frame(
        [
            *rejected_at(TECH_INTERVIEW, reason="skills_gap", count=2),
            *rejected_at(TECH_INTERVIEW, reason="english_level", count=2),
            *cohort(APPLIED, end=("ghosted", None), count=6),
        ]
    )
    leading = reasons(tied, stage=None, now=DESIGN_NOW)

    assert leading.headline is None
    assert dominant_reason(replace(metrics, reasons=leading)) is None


@pytest.mark.parametrize(
    ("ghosted", "applications", "title", "body"),
    [
        (
            2,
            20,
            "2 компанії не відповіли",
            "Це 10% твоїх відгуків — на 8 п.п. менше за ринок.",
        ),
        (4, 20, "4 компанії не відповіли", "Це 20% твоїх відгуків — у межах ринку."),
        (21, 100, "21 компанія не відповіла", "Це 21% твоїх відгуків — у межах ринку."),
    ],
    ids=["below", "within", "21 companies"],
)
def test_compares_the_ghost_share_with_the_market(
    metrics: InsightMetrics,
    *,
    ghosted: int,
    applications: int,
    title: str,
    body: str,
) -> None:
    events = reasoned_frame(
        [
            *cohort(APPLIED, end=("ghosted", None), count=ghosted),
            *cohort(APPLIED, end=("rejected", None), count=applications - ghosted),
        ]
    )

    said = ghost_share(replace(metrics, ghosts=ghost_rate_vs_market(events)))

    assert said is not None
    assert (said.title, said.body) == (title, body)


def test_compares_no_sources_while_only_one_source_has_a_rate(
    metrics: InsightMetrics,
) -> None:
    kept = [
        source
        for source in metrics.sources.sources
        if source.source in {"linkedin", "referral"}
    ]
    only_linkedin = metrics.sources.model_copy(update={"sources": kept})

    assert weak_and_strong_source(replace(metrics, sources=only_linkedin)) is None


def test_every_rule_stays_silent_on_insufficient_metrics() -> None:
    tiny = tiny_metrics()
    comparison = tiny.resume_ab.comparison
    assert comparison is not None
    measured = [
        tiny.most_expensive,
        tiny.reasons.headline,
        tiny.ghosts.rate,
        comparison.verdict,
        *(stage.conversion for stage in tiny.stages if stage.conversion),
        *(source.conversion for source in tiny.sources.sources),
    ]

    assert all(isinstance(metric, Insufficient) for metric in measured)
    assert [rule(tiny) for rule in engine.RULES] == [None] * 6


def test_a_rule_declared_anywhere_joins_the_insights_without_an_engine_edit(
    metrics: InsightMetrics, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(engine, "RULES", [*engine.RULES])

    @insight_rule
    def declared_here(_: InsightMetrics) -> Insight:
        return Insight(
            block="ghosted", title="declared", body="", severity="neutral", evidence={}
        )

    titles = [insight.title for insight in insights(metrics).insights]

    assert [rule.__name__ for rule in engine.RULES] == [
        "dominant_reason",
        "narrowest_step",
        "ghost_share",
        "most_expensive_stage",
        "resume_switch",
        "weak_and_strong_source",
        "declared_here",
    ]
    assert titles[-2:] == ["17 компаній не відповіли", "declared"]
