import pytest

from app.core.config import Settings
from app.providers import provider_for
from app.providers.anthropic import AnthropicProvider
from app.providers.fake import FakeAiProvider
from app.providers.openai import OpenAiProvider


def provider_from_env(monkeypatch: pytest.MonkeyPatch, env: dict[str, str]) -> object:
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    return provider_for(Settings(_env_file=None))


def test_picks_the_fake_provider_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    assert type(provider_from_env(monkeypatch, {})) is FakeAiProvider


@pytest.mark.parametrize(
    ("env", "provider_class", "base_url", "api_key"),
    [
        (
            {
                "AI_PROVIDER": "anthropic",
                "AI_MODEL": "claude-test",
                "ANTHROPIC_API_KEY": "sk-ant-test",
            },
            AnthropicProvider,
            "https://api.anthropic.com",
            "sk-ant-test",
        ),
        (
            {
                "AI_PROVIDER": "openai",
                "AI_MODEL": "gpt-test",
                "OPENAI_API_KEY": "sk-test",
            },
            OpenAiProvider,
            "https://api.openai.com/v1/",
            "sk-test",
        ),
        (
            {
                "AI_PROVIDER": "nvidia",
                "AI_MODEL": "nvidia/test",
                "NVIDIA_API_KEY": "nvapi-test",
            },
            OpenAiProvider,
            "https://integrate.api.nvidia.com/v1/",
            "nvapi-test",
        ),
    ],
    ids=["anthropic", "openai", "nvidia"],
)
def test_picks_the_vendor_provider_from_env_only(
    *,
    monkeypatch: pytest.MonkeyPatch,
    env: dict[str, str],
    provider_class: type[AnthropicProvider | OpenAiProvider],
    base_url: str,
    api_key: str,
) -> None:
    provider = provider_from_env(monkeypatch, env)

    assert isinstance(provider, provider_class)
    assert (
        str(provider.client.base_url),
        provider.client.api_key,
        provider.vendor.model,
    ) == (
        base_url,
        api_key,
        env["AI_MODEL"],
    )
    assert (provider.vendor.timeout_seconds, provider.vendor.max_retries) == (30, 2)
