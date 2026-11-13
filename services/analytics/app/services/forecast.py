from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncEngine

from app.metrics.forecast import Forecast, WhatIf, forecast
from app.metrics.rate import Insufficient
from app.services.search_events import load_scoped_events


async def search_forecast(
    engine: AsyncEngine,
    *,
    user_id: UUID,
    search_id: UUID | None,
    what_if: WhatIf,
    now: datetime,
) -> Forecast | Insufficient:
    events = await load_scoped_events(engine, user_id=user_id, search_id=search_id)
    return forecast(events, now=now, what_if=what_if)
