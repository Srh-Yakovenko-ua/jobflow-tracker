import pytest

from app.metrics.sankey import Sankey, SankeyGraph, SankeySplit, sankey
from tests.factories import StageEvent, application, moves, stage_events_frame
from tests.metrics.funnel_design import design_frame
from tests.metrics.sankey_fixtures import (
    APPLIED,
    SCREENING,
    Journey,
    cohort,
    five_hundred_applications,
    reasoned_frame,
    rejected_at,
    three_hundred_eighty_applications,
)
from tests.metrics.test_funnel import (
    REVIVED_GHOSTED,
    SKIPPED_SCREENING,
    UNDONE_SCREENING,
)

type LinkRow = tuple[str, str, int, bool]

EMPTY = SankeyGraph(nodes=[], links=[])

GHOSTED_THEN_REVIVED: Journey = [
    ("applied", None),
    ("screening", None),
    ("ghosted", "silence_timeout"),
    ("screening", None),
]

PATHS: dict[str, tuple[list[StageEvent], list[LinkRow]]] = {
    "skipped screening": (
        SKIPPED_SCREENING,
        [
            ("applied", "tech_interview", 1, False),
            ("tech_interview", "in_progress", 1, False),
        ],
    ),
    "revived ghosted": (
        REVIVED_GHOSTED,
        [("applied", "screening", 1, False), ("screening", "in_progress", 1, False)],
    ),
    "undone screening": (UNDONE_SCREENING, [("applied", "in_progress", 1, False)]),
    "repeated tech interview round": (
        moves(
            application(0),
            ["applied", "screening", "tech_interview", "tech_interview", "final"],
        ),
        [
            ("applied", "screening", 1, False),
            ("screening", "tech_interview", 1, False),
            ("tech_interview", "final", 1, False),
            ("final", "in_progress", 1, False),
        ],
    ),
    "declined offer": (
        moves(application(0), ["applied", "screening", "offer", "withdrawn"]),
        [
            ("applied", "screening", 1, False),
            ("screening", "offer", 1, False),
            ("offer", "withdrawn", 1, False),
        ],
    ),
}


def link_rows(graph: SankeyGraph) -> list[LinkRow]:
    return [(link.from_, link.to, link.flow, link.ghost) for link in graph.links]


def node_ids(graph: SankeyGraph) -> list[str]:
    return [node.id for node in graph.nodes]


def test_the_design_fixture_gives_the_14_design_flows_with_ghost_links_flagged() -> (
    None
):
    design = sankey(design_frame(), split=None)

    assert link_rows(design.detailed) == [
        ("applied", "screening", 17, False),
        ("applied", "rejected", 21, False),
        ("applied", "ghosted", 14, True),
        ("applied", "withdrawn", 2, False),
        ("screening", "tech_interview", 9, False),
        ("screening", "rejected", 5, False),
        ("screening", "ghosted", 2, True),
        ("screening", "withdrawn", 1, False),
        ("tech_interview", "final", 4, False),
        ("tech_interview", "rejected", 4, False),
        ("tech_interview", "ghosted", 1, True),
        ("final", "offer", 1, False),
        ("final", "rejected", 2, False),
        ("final", "withdrawn", 1, False),
    ]
    assert [(node.id, node.kind) for node in design.detailed.nodes] == [
        ("applied", "stage"),
        ("screening", "stage"),
        ("tech_interview", "stage"),
        ("final", "stage"),
        ("offer", "stage"),
        ("rejected", "outcome"),
        ("ghosted", "outcome"),
        ("withdrawn", "outcome"),
    ]
    assert design.merged == design.detailed


@pytest.mark.parametrize(("rows", "links"), list(PATHS.values()), ids=list(PATHS))
def test_one_path_per_application_runs_in_stage_order_without_cycles(
    rows: list[StageEvent], links: list[LinkRow]
) -> None:
    graph = sankey(stage_events_frame(rows), split=None)

    assert link_rows(graph.detailed) == links
    assert graph.merged == graph.detailed


@pytest.mark.parametrize("split", [None, "reason"])
def test_no_events_give_empty_graphs(split: SankeySplit | None) -> None:
    assert sankey(stage_events_frame([]), split=split) == Sankey(
        split=split, detailed=EMPTY, merged=EMPTY
    )


def test_the_reason_split_puts_the_last_reason_in_place_of_rejected() -> None:
    frame = reasoned_frame(
        [
            *rejected_at(SCREENING, reason="skills_gap", count=1),
            *cohort(APPLIED, end=("rejected", None), count=1),
            *cohort(SCREENING, end=("ghosted", "silence_timeout"), count=1),
            [*GHOSTED_THEN_REVIVED, ("rejected", None)],
        ]
    )

    graph = sankey(frame, split="reason")

    assert link_rows(graph.detailed) == [
        ("applied", "screening", 3, False),
        ("applied", "unspecified", 1, False),
        ("screening", "skills_gap", 1, False),
        ("screening", "unspecified", 1, False),
        ("screening", "ghosted", 1, True),
    ]
    assert [(node.id, node.kind) for node in graph.detailed.nodes][2:4] == [
        ("skills_gap", "reason"),
        ("unspecified", "reason"),
    ]
    assert graph.merged == graph.detailed


def test_a_reason_three_px_wide_stays_and_one_two_px_wide_folds_into_other() -> None:
    graph = sankey(three_hundred_eighty_applications(), split="reason")

    assert node_ids(graph.detailed) == [
        "applied",
        "skills_gap",
        "english_level",
        "in_progress",
    ]
    assert link_rows(graph.merged) == [
        ("applied", "skills_gap", 3, False),
        ("applied", "other", 2, False),
        ("applied", "in_progress", 375, False),
    ]


def test_five_hundred_applications_show_at_most_14_nodes_once_merged() -> None:
    graph = sankey(five_hundred_applications(), split="reason")

    assert len(graph.detailed.nodes) == 20
    assert node_ids(graph.merged) == [
        "applied",
        "screening",
        "tech_interview",
        "final",
        "offer",
        "skills_gap",
        "english_level",
        "salary_expectations",
        "chose_other",
        "position_closed",
        "ghosted",
        "withdrawn",
        "other",
        "in_progress",
    ]
    assert [row for row in link_rows(graph.merged) if row[1] == "other"] == [
        ("applied", "other", 43, False),
        ("screening", "other", 32, False),
    ]


def test_without_a_split_the_five_hundred_applications_keep_one_rejected_node() -> None:
    graph = sankey(five_hundred_applications(), split=None)

    assert len(graph.detailed.nodes) == 9
    assert graph.merged == graph.detailed


def test_dumps_links_with_the_from_to_flow_keys_of_chartjs_sankey() -> None:
    dumped = sankey(design_frame(), split=None).model_dump(by_alias=True)

    assert sorted(dumped) == ["detailed", "merged", "split"]
    assert dumped["detailed"]["links"][0] == {
        "from": "applied",
        "to": "screening",
        "flow": 17,
        "ghost": False,
    }
    assert dumped["detailed"]["nodes"][0] == {"id": "applied", "kind": "stage"}
