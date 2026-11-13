from app.metrics.insights.engine import insights
from tests.metrics.insights_design import DESIGN_INSIGHTS_BODY, design_metrics


def test_the_design_fixture_speaks_the_design_headlines() -> None:
    body = insights(design_metrics()).model_dump(by_alias=True, mode="json")

    assert body == DESIGN_INSIGHTS_BODY
