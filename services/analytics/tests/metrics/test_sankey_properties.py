from collections import Counter

from hypothesis import given, settings
from hypothesis import strategies as st

from app.core.enums import progress_stages
from app.metrics.sankey import SankeyGraph, SankeySplit, sankey
from tests.metrics.journey_strategies import cohorts
from tests.metrics.sankey_fixtures import Journey, reasoned_frame

SINK_KINDS = {"outcome", "reason", "other", "in_progress"}


def balances(graph: SankeyGraph) -> tuple[Counter[str], Counter[str]]:
    inflow: Counter[str] = Counter()
    outflow: Counter[str] = Counter()
    for link in graph.links:
        inflow[link.to] += link.flow
        outflow[link.from_] += link.flow
    return inflow, outflow


def assert_conserved(graph: SankeyGraph, *, applications: int) -> None:
    inflow, outflow = balances(graph)
    *passing, offer = progress_stages()
    sinks = [node.id for node in graph.nodes if node.kind in SINK_KINDS]

    assert all(link.flow > 0 for link in graph.links)
    assert outflow[passing[0]] == applications
    assert all(inflow[stage] == outflow[stage] for stage in passing[1:])
    assert inflow[offer] >= outflow[offer]
    kept_at_offer = inflow[offer] - outflow[offer]
    assert sum(inflow[sink] for sink in sinks) + kept_at_offer == applications


@settings(deadline=None, derandomize=True)
@given(
    applications=cohorts,
    split=st.sampled_from([None, "reason"]),
)
def test_every_stage_passes_on_what_flows_into_it(
    applications: list[Journey], split: SankeySplit | None
) -> None:
    graph = sankey(reasoned_frame(applications), split=split)

    assert_conserved(graph.detailed, applications=len(applications))
    assert_conserved(graph.merged, applications=len(applications))
