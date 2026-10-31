from app.core.config import Settings
from app.providers.anthropic import AnthropicProvider
from app.providers.base import AiProvider, VendorSettings
from app.providers.fake import FakeAiProvider
from app.providers.openai import OpenAiProvider


def vendor_settings_of(settings: Settings) -> VendorSettings:
    return VendorSettings(
        api_key=settings.vendor_key(),
        model=settings.ai_model,
        embedding_model=settings.ai_embedding_model,
        base_url=settings.nvidia_base_url if settings.ai_provider == "nvidia" else None,
        timeout_seconds=settings.ai_timeout_seconds,
        max_retries=settings.ai_max_retries,
        nvidia=settings.ai_provider == "nvidia",
    )


def provider_for(settings: Settings) -> AiProvider:
    if settings.ai_provider == "fake":
        return FakeAiProvider()
    vendor = vendor_settings_of(settings)
    if settings.ai_provider == "anthropic":
        return AnthropicProvider(vendor)
    return OpenAiProvider(vendor)
