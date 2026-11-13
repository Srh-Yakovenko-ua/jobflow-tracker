from uuid import UUID

import pandas as pd

from app.core.enums import GHOSTED_STAGE
from app.metrics.rate import Insufficient, Rate, rate


def clean_events(events: pd.DataFrame) -> pd.DataFrame:
    compensated = events["compensates_event_id"].dropna()
    effective = events["compensates_event_id"].isna() & ~events["id"].isin(compensated)
    return events[effective].sort_values(["occurred_at", "id"]).reset_index(drop=True)


def ghosted_application_ids(events: pd.DataFrame) -> set[UUID]:
    last = clean_events(events).groupby("application_id").tail(1)
    return set(last.loc[last["to_stage"] == GHOSTED_STAGE, "application_id"])


def conversion(events: pd.DataFrame, *, to_stage: str) -> Rate | Insufficient:
    clean = clean_events(events)
    kept = clean[~clean["application_id"].isin(ghosted_application_ids(clean))]
    reached = kept.loc[kept["to_stage"] == to_stage, "application_id"].nunique()
    return rate(reached, kept["application_id"].nunique())


def ghost_rate(events: pd.DataFrame) -> Rate | Insufficient:
    clean = clean_events(events)
    ghosted = ghosted_application_ids(clean)
    return rate(len(ghosted), clean["application_id"].nunique())
