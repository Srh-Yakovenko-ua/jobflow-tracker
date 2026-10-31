import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_defaults_to_the_fake_provider_with_no_vendor_settings() -> None:
    settings = Settings(_env_file=None)

    assert (
        settings.ai_provider,
        settings.ai_timeout_seconds,
        settings.ai_rate_limit_per_minute,
    ) == (
        "fake",
        30,
        35,
    )


@pytest.mark.parametrize(
    ("env", "missing"),
    [
        ({"AI_PROVIDER": "anthropic"}, "AI_MODEL, ANTHROPIC_API_KEY"),
        ({"AI_PROVIDER": "openai", "AI_MODEL": "gpt-test"}, "OPENAI_API_KEY"),
        ({"AI_PROVIDER": "nvidia", "NVIDIA_API_KEY": "nvapi-test"}, "AI_MODEL"),
        (
            {"AI_PROVIDER": "nvidia", "AI_MODEL": "", "NVIDIA_API_KEY": "nvapi-test"},
            "AI_MODEL",
        ),
    ],
)
def test_refuses_a_vendor_provider_without_its_model_or_key(
    *, monkeypatch: pytest.MonkeyPatch, env: dict[str, str], missing: str
) -> None:
    for name, value in env.items():
        monkeypatch.setenv(name, value)

    with pytest.raises(ValidationError, match=f"needs {missing}"):
        Settings(_env_file=None)


def test_refuses_an_unknown_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "mistral")

    with pytest.raises(ValidationError, match="ai_provider"):
        Settings(_env_file=None)
