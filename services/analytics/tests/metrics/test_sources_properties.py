from hypothesis import event, example, given, settings
from hypothesis import strategies as st

from app.core.enums import load_domain_enums
from app.metrics.rate import Rate, wilson_interval
from app.metrics.source_ranking import RATED_TIER, SMALL_SAMPLE_TIER
from app.metrics.sources import SourcePerformance, sources
from tests.factories import ApplicationSource, application, application_sources_frame
from tests.metrics.journey_strategies import journeys
from tests.metrics.sankey_fixtures import Journey, reasoned_frame

type SourceCohort = tuple[str, list[Journey]]

SCREENED: Journey = [("applied", None), ("screening", None)]

source_cohorts = st.lists(
    st.tuples(
        st.sampled_from(load_domain_enums().sources),
        st.lists(journeys, min_size=1, max_size=12),
    ),
    min_size=1,
    max_size=6,
)


def trials_of(row: SourcePerformance) -> int:
    conversion = row.conversion
    return conversion.trials if isinstance(conversion, Rate) else conversion.have


def tier_of(row: SourcePerformance) -> tuple[int, float]:
    if isinstance(row.conversion, Rate):
        return RATED_TIER, -row.conversion.low
    low, _ = wilson_interval(row.screenings, trials_of(row))
    return SMALL_SAMPLE_TIER, -low


@settings(deadline=None, derandomize=True)
@given(cohorts=source_cohorts)
@example(cohorts=[("djinni", [SCREENED] * 6), ("referral", [SCREENED] * 3)])
def test_ranks_rated_sources_before_small_samples_by_the_wilson_lower_bound(
    cohorts: list[SourceCohort],
) -> None:
    paths = [journey for _, cohort in cohorts for journey in cohort]
    labels = [source for source, cohort in cohorts for _ in cohort]
    origins = application_sources_frame(
        [
            ApplicationSource(application(index), source)
            for index, source in enumerate(labels)
        ]
    )

    ranked = sources(reasoned_frame(paths), origins=origins).sources

    with_trials = [row for row in ranked if trials_of(row) > 0]
    keys = [tier_of(row) for row in with_trials]
    event(f"tiers seen: {sorted({tier for tier, _ in keys})}")
    assert keys == sorted(keys)
    assert ranked[: len(with_trials)] == with_trials
    assert sum(row.applications for row in ranked) == len(paths)
