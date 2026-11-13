from datetime import datetime

import pandas as pd

from app.metrics.data_rules import clean_events
from app.metrics.forecast import Forecast, WhatIf, forecast
from app.metrics.funnel import funnel_stages
from app.metrics.ghost_market import ghost_rate_vs_market
from app.metrics.insights.engine import WHAT_IF_CONVERSION, InsightMetrics
from app.metrics.journeys import journeys
from app.metrics.most_expensive import MostExpensiveStage, most_expensive
from app.metrics.offer_simulation import Improvement
from app.metrics.rate import Insufficient
from app.metrics.reasons import reasons
from app.metrics.resume_ab import resume_ab
from app.metrics.sources import sources


def stage_what_if(
    events: pd.DataFrame,
    *,
    costliest: MostExpensiveStage | Insufficient | None,
    now: datetime,
) -> Forecast | Insufficient | None:
    if not isinstance(costliest, MostExpensiveStage):
        return None
    if costliest.passed / costliest.reached >= WHAT_IF_CONVERSION:
        return None
    improve = Improvement(costliest.stage, WHAT_IF_CONVERSION)
    return forecast(events, now=now, what_if=WhatIf(improve=improve))


def insight_metrics(
    events: pd.DataFrame,
    *,
    origins: pd.DataFrame,
    links: pd.DataFrame,
    now: datetime,
) -> InsightMetrics:
    clean = clean_events(events)
    rows = journeys(clean)
    costliest = most_expensive(rows)
    return InsightMetrics(
        applications=int(clean["application_id"].nunique()),
        stages=funnel_stages(rows),
        most_expensive=costliest,
        reasons=reasons(events, stage=None, now=now),
        sources=sources(events, origins=origins),
        resume_ab=resume_ab(events, links=links),
        ghosts=ghost_rate_vs_market(events),
        stage_what_if=stage_what_if(events, costliest=costliest, now=now),
    )
