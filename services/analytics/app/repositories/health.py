from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def select_one(engine: AsyncEngine) -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
