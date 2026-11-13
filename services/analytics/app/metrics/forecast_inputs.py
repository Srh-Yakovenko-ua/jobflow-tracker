from datetime import datetime, timedelta
from typing import Final, NamedTuple

import numpy as np
import numpy.typing as npt
import pandas as pd

from app.core.enums import load_domain_enums
from app.metrics.journeys import ended_at, reached

RATE_WINDOW: Final = timedelta(weeks=4)
WEEK: Final = pd.Timedelta(weeks=1)
DAY: Final = pd.Timedelta(days=1)

type Days = npt.NDArray[np.float64]


class PassCounts(NamedTuple):
    successes: tuple[int, ...]
    failures: tuple[int, ...]


class InFlight(NamedTuple):
    stages: npt.NDArray[np.int64]
    elapsed_days: Days


def stage_pass_counts(rows: pd.DataFrame) -> PassCounts:
    enums = load_domain_enums()
    indexes = range(len(enums.active_stages))
    return PassCounts(
        successes=tuple(reached(rows, index=index + 1) for index in indexes),
        failures=tuple(
            int(
                ended_at(rows, index=index)["outcome"].isin(enums.terminal_stages).sum()
            )
            for index in indexes
        ),
    )


def stay_pools(stays: pd.DataFrame) -> tuple[Days, ...]:
    pooled = stays["days"].to_numpy(dtype=np.float64)
    pools = (
        stays.loc[stays["stage"] == stage, "days"].to_numpy(dtype=np.float64)
        for stage in load_domain_enums().active_stages
    )
    return tuple(pool if pool.size else pooled for pool in pools)


def in_flight(clean: pd.DataFrame, *, now: datetime) -> InFlight:
    active = list(load_domain_enums().active_stages)
    last = clean.groupby("application_id").last()
    open_now = last[last["to_stage"].isin(active)]
    since = pd.Timestamp(now) - pd.to_datetime(open_now["occurred_at"], utc=True)
    return InFlight(
        stages=open_now["to_stage"].map(active.index).to_numpy(dtype=np.int64),
        elapsed_days=np.asarray(since / DAY, dtype=np.float64),
    )


def applications_per_week(rows: pd.DataFrame, *, now: datetime) -> float:
    started = rows["started_at"]
    recent = int(((started >= now - RATE_WINDOW) & (started < now)).sum())
    weeks = (pd.Timestamp(now) - started.min()) / WEEK
    return recent / float(np.clip(weeks, 1, RATE_WINDOW / WEEK))
