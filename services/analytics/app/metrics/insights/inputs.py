from datetime import datetime

import pandas as pd

from app.metrics.data_rules import clean_events
from app.metrics.funnel import funnel_stages
from app.metrics.ghost_market import ghost_rate_vs_market
from app.metrics.insights.engine import InsightMetrics
from app.metrics.journeys import journeys
from app.metrics.most_expensive import most_expensive
from app.metrics.reasons import reasons
from app.metrics.resume_ab import resume_ab
from app.metrics.sources import sources


def insight_metrics(
    events: pd.DataFrame,
    *,
    origins: pd.DataFrame,
    links: pd.DataFrame,
    now: datetime,
) -> InsightMetrics:
    clean = clean_events(events)
    rows = journeys(clean)
    return InsightMetrics(
        applications=int(clean["application_id"].nunique()),
        stages=funnel_stages(rows),
        most_expensive=most_expensive(rows),
        reasons=reasons(events, stage=None, now=now),
        sources=sources(events, origins=origins),
        resume_ab=resume_ab(events, links=links),
        ghosts=ghost_rate_vs_market(events),
    )
