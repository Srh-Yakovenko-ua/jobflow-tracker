import pytest
from pydantic import ValidationError

from app.core.config import Settings
from tests.factories import REQUIRED_ENV


@pytest.fixture
def required_env(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    for name, value in REQUIRED_ENV.items():
        monkeypatch.setenv(name, value)
    return monkeypatch


@pytest.mark.parametrize("missing", ["DATABASE_URL_ANALYTICS", "REDIS_URL"])
def test_refuses_to_boot_without_a_required_url(
    required_env: pytest.MonkeyPatch, missing: str
) -> None:
    required_env.delenv(missing)

    with pytest.raises(ValidationError, match=missing.lower()):
        Settings(_env_file=None)


def test_refuses_a_database_url_that_is_not_postgresql(
    required_env: pytest.MonkeyPatch,
) -> None:
    required_env.setenv("DATABASE_URL_ANALYTICS", "mysql://user:test@db:3306/jobflow")

    with pytest.raises(ValidationError, match=r"must start with postgresql://"):
        Settings(_env_file=None)


def test_swaps_in_the_asyncpg_driver_and_keeps_the_rest_of_the_url(
    required_env: pytest.MonkeyPatch,
) -> None:
    settings = Settings(_env_file=None)

    assert (settings.database_url_analytics, settings.async_database_url) == (
        "postgresql://jobflow_analytics:test@db:5432/jobflow",
        "postgresql+asyncpg://jobflow_analytics:test@db:5432/jobflow",
    )
