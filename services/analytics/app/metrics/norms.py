import pandas as pd

from app.metrics.data_rules import clean_events
from app.metrics.days_to_offer import days_to_offer
from app.metrics.rate import MetricModel
from app.metrics.response_time import ResponseTime, median_response
from app.metrics.stage_timing import stage_norms, stage_stays, whole_days


class Norms(MetricModel):
    stage_norm_days: dict[str, int | None]
    median_days_to_offer: int | None


def norms(events: pd.DataFrame) -> Norms:
    clean = clean_events(events)
    to_offer = median_response(days_to_offer(clean))
    return Norms(
        stage_norm_days=stage_norms(stage_stays(clean)),
        median_days_to_offer=(
            whole_days(to_offer.days) if isinstance(to_offer, ResponseTime) else None
        ),
    )
