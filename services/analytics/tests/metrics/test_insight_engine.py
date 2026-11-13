from dataclasses import replace
from datetime import timedelta

import pytest

from app.metrics.ghost_market import GhostGap
from app.metrics.insights import engine
from app.metrics.insights.engine import (
    Insight,
    InsightBlock,
    InsightMetrics,
    insight_rule,
    insights,
)
from app.metrics.insights.inputs import insight_metrics
from tests.factories import EVENTS_BASE_TIME, version_links_frame
from tests.metrics.sources_design import design_events, design_origins


@pytest.fixture(name="metrics")
def design_metrics() -> InsightMetrics:
    return insight_metrics(
        design_events(),
        origins=design_origins(),
        links=version_links_frame([]),
        now=EVENTS_BASE_TIME + timedelta(days=60),
    )


@pytest.fixture(name="rules")
def own_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(engine, "RULES", [])


def said(block: InsightBlock, *, title: str) -> Insight:
    return Insight(block=block, title=title, body="", severity="neutral", evidence={})


def test_inputs_count_every_application_in_scope_once(metrics: InsightMetrics) -> None:
    entry = metrics.stages[0]

    assert metrics.applications == 56
    assert (entry.stage, entry.reached, entry.passed) == ("applied", 56, 17)
    assert metrics.ghosts.gap == GhostGap(position="below", points=7)
    assert metrics.resume_ab.comparison is None


@pytest.mark.usefixtures("rules")
def test_no_rule_runs_below_the_insight_threshold(metrics: InsightMetrics) -> None:
    @insight_rule
    def always(_: InsightMetrics) -> Insight:
        return said("ghosted", title="always")

    assert insights(replace(metrics, applications=9)).insights == []
    assert insights(replace(metrics, applications=10)).insights == [always(metrics)]


@pytest.mark.usefixtures("rules")
def test_insights_follow_block_order_then_registration_and_skip_silent_rules(
    metrics: InsightMetrics,
) -> None:
    @insight_rule
    def ghosts(_: InsightMetrics) -> Insight:
        return said("ghosted", title="ghosts")

    @insight_rule
    def silent(_: InsightMetrics) -> None:
        return None

    @insight_rule
    def narrowest(_: InsightMetrics) -> Insight:
        return said("funnel", title="narrowest")

    @insight_rule
    def costliest(_: InsightMetrics) -> Insight:
        return said("funnel", title="costliest")

    @insight_rule
    def leading_reason(_: InsightMetrics) -> Insight:
        return said("reasons", title="reason")

    titles = [insight.title for insight in insights(metrics).insights]

    assert titles == ["narrowest", "costliest", "reason", "ghosts"]
