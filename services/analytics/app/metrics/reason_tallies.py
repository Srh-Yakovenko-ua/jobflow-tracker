import pandas as pd

from app.core.enums import (
    REJECTED_STAGE,
    UNSPECIFIED_REASON,
    load_domain_enums,
    reason_codes,
)
from app.metrics.rate import MetricModel


class ReasonCount(MetricModel):
    code: str
    count: int


def stage_rejections(clean: pd.DataFrame, *, stage: str) -> pd.Series[str]:
    left = clean[(clean["to_stage"] == REJECTED_STAGE) & (clean["from_stage"] == stage)]
    codes: pd.Series[str] = left.set_index("occurred_at")["reason_code"]
    return codes.fillna(UNSPECIFIED_REASON)


def tallies(codes: pd.Series[str]) -> list[ReasonCount]:
    rank = {code: order for order, code in enumerate(reason_codes())}
    counted = [
        ReasonCount(code=str(code), count=int(count))
        for code, count in codes.value_counts().items()
    ]
    return sorted(counted, key=lambda reason: (-reason.count, rank[reason.code]))


def leading(counted: list[ReasonCount]) -> ReasonCount | None:
    if not counted or (len(counted) > 1 and counted[1].count == counted[0].count):
        return None
    return counted[0]


def side_of() -> dict[str, str]:
    return {
        reason.code: reason.side for reason in load_domain_enums().rejection_reasons
    }


def stated_sides() -> tuple[str, ...]:
    system = side_of()[UNSPECIFIED_REASON]
    return tuple(side for side in load_domain_enums().rejection_sides if side != system)
