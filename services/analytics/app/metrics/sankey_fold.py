from collections import Counter
from functools import cache
from typing import Final, Literal

from app.core.enums import (
    REJECTED_STAGE,
    progress_stages,
    reason_codes,
    stages_with_role,
)

type SankeyNodeKind = Literal["stage", "outcome", "reason", "other", "in_progress"]
type Flows = Counter[tuple[str, str]]

SANKEY_CHART_HEIGHT_PX: Final = 380
MIN_BRANCH_PX: Final = 3
MAX_VISIBLE_NODES: Final = 14
IN_PROGRESS_NODE: Final = "in_progress"
OTHER_NODE: Final = "other"


@cache
def node_kinds() -> dict[str, SankeyNodeKind]:
    kinds: dict[str, SankeyNodeKind] = {stage: "stage" for stage in progress_stages()}
    for outcome in stages_with_role("outcome"):
        kinds[outcome] = "outcome"
        if outcome == REJECTED_STAGE:
            kinds |= {code: "reason" for code in reason_codes()}
    return kinds | {OTHER_NODE: "other", IN_PROGRESS_NODE: "in_progress"}


def inflows(counted: Flows) -> Counter[str]:
    totals: Counter[str] = Counter()
    for (_, target), flow in counted.items():
        totals[target] += flow
    return totals


def folded_reasons(counted: Flows, *, applications: int) -> set[str]:
    kinds = node_kinds()
    order = list(kinds)
    inflow = inflows(counted)
    reasons = sorted(
        (node for node in inflow if kinds[node] == "reason"),
        key=lambda node: (-inflow[node], order.index(node)),
    )
    wide = [
        node
        for node in reasons
        if inflow[node] * SANKEY_CHART_HEIGHT_PX >= MIN_BRANCH_PX * applications
    ]
    shown = {node for pair in counted for node in pair} - set(reasons)
    if len(wide) == len(reasons) and len(shown) + len(wide) <= MAX_VISIBLE_NODES:
        return set()
    room = max(0, MAX_VISIBLE_NODES - len(shown) - 1)
    return set(reasons) - set(wide[:room])


def fold(counted: Flows, *, applications: int) -> Flows:
    folded = folded_reasons(counted, applications=applications)
    merged: Flows = Counter()
    for (source, target), flow in counted.items():
        merged[source, OTHER_NODE if target in folded else target] += flow
    return merged
