import pandas as pd

from app.core.enums import STAGE_ROLES, progress_stages


def journeys(clean: pd.DataFrame) -> pd.DataFrame:
    stages = list(progress_stages())
    moments = clean.assign(occurred_at=pd.to_datetime(clean["occurred_at"], utc=True))
    by_application = moments.groupby("application_id")
    last_stage = by_application["to_stage"].last()
    entries: pd.DataFrame = (
        moments[moments["to_stage"].isin(stages)]
        .groupby(["application_id", "to_stage"])["occurred_at"]
        .min()
        .unstack()
        .reindex(index=last_stage.index, columns=stages)
        .apply(pd.to_datetime, utc=True)
    )
    levels = pd.Series(range(1, len(stages) + 1), index=stages)
    depth = entries.notna().mul(levels).max(axis=1) - 1
    is_outcome = last_stage.map(STAGE_ROLES) == "outcome"
    return entries.assign(
        deepest=depth,
        outcome=last_stage.where(is_outcome),
        started_at=by_application["occurred_at"].min(),
    )


def reached(rows: pd.DataFrame, *, index: int) -> int:
    return int((rows["deepest"] >= index).sum())


def ended_at(rows: pd.DataFrame, *, index: int) -> pd.DataFrame:
    return rows[(rows["deepest"] == index) & rows["outcome"].notna()]
