from dataclasses import dataclass
from typing import Final

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

POSTGRES_SCHEME = "postgresql://"
ASYNCPG_SCHEME = "postgresql+asyncpg://"


@dataclass(frozen=True)
class DependencyLimits:
    connect: float
    ping: float
    query: float


DEPENDENCY_LIMITS: Final = DependencyLimits(connect=2.0, ping=1.0, query=3.0)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../../.env",
        env_ignore_empty=True,
        extra="ignore",
        frozen=True,
        hide_input_in_errors=True,
    )

    database_url_analytics: str
    redis_url: str
    log_level: str = "INFO"

    @field_validator("database_url_analytics")
    @classmethod
    def require_postgres_scheme(cls, url: str) -> str:
        if not url.startswith(POSTGRES_SCHEME):
            raise ValueError(f"must start with {POSTGRES_SCHEME}")
        return url

    @property
    def async_database_url(self) -> str:
        return ASYNCPG_SCHEME + self.database_url_analytics.removeprefix(
            POSTGRES_SCHEME
        )
