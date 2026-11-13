from collections import Counter
from itertools import pairwise
from typing import Literal

import pandas as pd
from pydantic import Field

from app.core.enums import (
    GHOSTED_STAGE,
    REJECTED_STAGE,
    UNSPECIFIED_REASON,
    progress_stages,
)
from app.metrics.data_rules import clean_events
from app.metrics.journeys import journeys
from app.metrics.rate import MetricModel
from app.metrics.sankey_fold import (
    IN_PROGRESS_NODE,
    Flows,
    SankeyNodeKind,
    fold,
    node_kinds,
)

type SankeySplit = Literal["reason"]


class SankeyNode(MetricModel):
    id: str
    kind: SankeyNodeKind


class SankeyLink(MetricModel):
    from_: str = Field(alias="from")
    to: str
    flow: int
    ghost: bool


class SankeyGraph(MetricModel):
    nodes: list[SankeyNode]
    links: list[SankeyLink]


class Sankey(MetricModel):
    split: SankeySplit | None
    detailed: SankeyGraph
    merged: SankeyGraph


def last_reasons(clean: pd.DataFrame) -> pd.Series[str]:
    last = clean.groupby("application_id").tail(1).set_index("application_id")
    return last["reason_code"].fillna(UNSPECIFIED_REASON)


def path_ends(rows: pd.DataFrame, *, reasons: pd.Series[str] | None) -> list[object]:
    outcome = rows["outcome"]
    if reasons is not None:
        outcome = outcome.mask(outcome == REJECTED_STAGE, reasons)
    at_offer = rows["deepest"] == len(progress_stages()) - 1
    open_end = at_offer.map({True: None, False: IN_PROGRESS_NODE})
    return outcome.fillna(open_end).tolist()


def flows(rows: pd.DataFrame, *, ends: list[object]) -> Flows:
    stages = list(progress_stages())
    counted: Flows = Counter()
    for entered, end in zip(rows[stages].notna().to_numpy(), ends, strict=True):
        path = [stage for stage, hit in zip(stages, entered, strict=True) if hit]
        counted.update(pairwise([*path, end] if isinstance(end, str) else path))
    return counted


def graph(counted: Flows) -> SankeyGraph:
    kinds = node_kinds()
    rank = {node: index for index, node in enumerate(kinds)}
    pairs = sorted(counted, key=lambda pair: (rank[pair[0]], rank[pair[1]]))
    present = {node for pair in pairs for node in pair}
    return SankeyGraph(
        nodes=[
            SankeyNode(id=node, kind=kind)
            for node, kind in kinds.items()
            if node in present
        ],
        links=[
            SankeyLink(
                from_=source,
                to=target,
                flow=counted[source, target],
                ghost=target == GHOSTED_STAGE,
            )
            for source, target in pairs
        ],
    )


def sankey(events: pd.DataFrame, *, split: SankeySplit | None) -> Sankey:
    clean = clean_events(events)
    rows = journeys(clean)
    reasons = None if split is None else last_reasons(clean)
    counted = flows(rows, ends=path_ends(rows, reasons=reasons))
    detailed = graph(counted)
    merged = detailed if split is None else graph(fold(counted, applications=len(rows)))
    return Sankey(split=split, detailed=detailed, merged=merged)
