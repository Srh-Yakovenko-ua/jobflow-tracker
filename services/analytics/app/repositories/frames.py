from typing import Any

import pandas as pd
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncEngine


async def read_frame(engine: AsyncEngine, statement: Select[Any]) -> pd.DataFrame:
    async with engine.connect() as connection:
        result = await connection.execute(statement)
        return pd.DataFrame(result.mappings().all(), columns=list(result.keys()))
