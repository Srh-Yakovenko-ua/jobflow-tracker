from hypothesis import given, settings

from app.metrics.rate import Rate
from app.metrics.reasons import StageReasons, reasons
from app.metrics.reasons_summary import reasons_summary
from tests.metrics.journey_strategies import cohorts
from tests.metrics.reasons_design import DESIGN_NOW
from tests.metrics.sankey_fixtures import Journey, reasoned_frame


def assert_adds_up(stage: StageReasons) -> None:
    counts = [reason.count for reason in stage.reasons]
    successes = [
        reason.share.successes
        for reason in stage.reasons
        if isinstance(reason.share, Rate)
    ]
    side_counts = [side.count for side in stage.sides.values()]

    assert sum(counts) == sum(side_counts) == stage.stated
    assert sum(successes) in {0, stage.stated}
    assert stage.stated + sum(reason.count for reason in stage.unstated) == stage.total
    assert all(0 < count <= stage.total for count in counts)


@settings(deadline=None, derandomize=True)
@given(applications=cohorts)
def test_stated_reasons_add_up_to_the_stated_count_within_the_total(
    applications: list[Journey],
) -> None:
    frame = reasoned_frame(applications)

    for stage in reasons(frame, stage=None, now=DESIGN_NOW).stages:
        assert_adds_up(stage)
        assert stage.total == reasons_summary(frame, stage=stage.stage).total
