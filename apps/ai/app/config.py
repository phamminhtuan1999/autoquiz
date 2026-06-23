from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AutoQuiz AI"
    environment: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="AUTOQUIZ_AI_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
