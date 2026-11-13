from datetime import datetime
from functools import partial
from zoneinfo import ZoneInfo

import pandas as pd

from app.core.enums import load_domain_enums, progress_stages
from app.metrics.rate import MetricModel


class SearchPeriod(MetricModel):
    started_at: datetime
    finished_at: datetime | None = None
    timezone: str


class MonthlyCount(MetricModel):
    total: int
    this_month: int
    previous_month: int


class FunnelKpis(MetricModel):
    sent: MonthlyCount
    interviews: MonthlyCount
    offers: MonthlyCount
    days_in_search: int


def month_number(moment: datetime) -> int:
    return moment.year * 12 + moment.month


def monthly(moments: pd.Series, *, zone: ZoneInfo, now: datetime) -> MonthlyCount:
    local = pd.to_datetime(moments.dropna(), utc=True).dt.tz_convert(zone)
    months = local.dt.year * 12 + local.dt.month
    current = month_number(now.astimezone(zone))
    return MonthlyCount(
        total=len(months),
        this_month=int((months == current).sum()),
        previous_month=int((months == current - 1).sum()),
    )


def kpis(rows: pd.DataFrame, *, period: SearchPeriod, now: datetime) -> FunnelKpis:
    stages = progress_stages()
    count = partial(monthly, zone=ZoneInfo(period.timezone), now=now)
    searching = (period.finished_at or now) - period.started_at
    return FunnelKpis(
        sent=count(rows["started_at"]),
        interviews=count(rows[list(load_domain_enums().interview_stages)].min(axis=1)),
        offers=count(rows[stages[-1]]),
        days_in_search=max(searching.days, 0),
    )
