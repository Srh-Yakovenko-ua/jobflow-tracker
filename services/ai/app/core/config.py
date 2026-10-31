from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

type ProviderName = Literal["fake", "anthropic", "openai", "nvidia"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore", frozen=True
    )

    ai_provider: ProviderName = "fake"
    ai_model: str = ""
    ai_embedding_model: str = ""
    anthropic_api_key: SecretStr = SecretStr("")
    openai_api_key: SecretStr = SecretStr("")
    nvidia_api_key: SecretStr = SecretStr("")
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    ai_timeout_seconds: float = Field(default=30, gt=0)
    ai_max_retries: int = Field(default=2, ge=0)
    ai_rate_limit_per_minute: int = Field(default=35, gt=0)
    api_jwks_url: str = "http://localhost:4000/.well-known/jwks.json"
    jwks_timeout_seconds: float = Field(default=2, gt=0)
    log_level: str = "INFO"

    def vendor_key(self) -> str:
        keys = {
            "anthropic": self.anthropic_api_key,
            "openai": self.openai_api_key,
            "nvidia": self.nvidia_api_key,
        }
        key = keys.get(self.ai_provider)
        return key.get_secret_value() if key is not None else ""

    @model_validator(mode="after")
    def require_vendor_settings(self) -> Self:
        if self.ai_provider == "fake":
            return self
        required = {
            "AI_MODEL": self.ai_model,
            f"{self.ai_provider.upper()}_API_KEY": self.vendor_key(),
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(
                f"AI_PROVIDER={self.ai_provider} needs {', '.join(missing)}"
            )
        return self
