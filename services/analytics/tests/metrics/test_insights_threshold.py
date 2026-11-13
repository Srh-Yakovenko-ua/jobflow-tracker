import pytest

from app.metrics.insights.engine import InsightBlock, insights
from tests.factories import version_links_frame
from tests.metrics.insights_design import one_source_metrics
from tests.metrics.reasons_design import design_frame


@pytest.mark.parametrize(
    ("ghosted", "blocks"),
    [(0, []), (1, ["funnel", "funnel", "reasons", "ghosted"])],
    ids=["9 applications", "10 applications"],
)
def test_no_rule_speaks_below_ten_applications_and_the_rules_speak_at_ten(
    ghosted: int, blocks: list[InsightBlock]
) -> None:
    metrics = one_source_metrics(
        design_frame(ghosted=ghosted), source="other", links=version_links_frame([])
    )

    said = insights(metrics).insights

    assert [insight.block for insight in said] == blocks
