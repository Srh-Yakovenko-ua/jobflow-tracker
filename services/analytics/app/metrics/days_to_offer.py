import pandas as pd

from app.core.enums import OFFER_STAGE
from app.metrics.journeys import journeys


def days_to_offer(clean: pd.DataFrame) -> pd.Series[float]:
    rows = journeys(clean)
    offered = pd.to_datetime(rows[OFFER_STAGE], utc=True)
    waited = offered - pd.to_datetime(rows["started_at"], utc=True)
    return waited.dropna() / pd.Timedelta(days=1)
