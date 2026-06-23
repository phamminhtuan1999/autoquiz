from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AutoQuiz AI"
    environment: str = "development"
    supabase_url: str = "http://localhost:54321"
    supabase_service_role_key: str = ""
    worker_id: str = "autoquiz-ai-local"
    job_types_csv: str = ""

    @property
    def job_types(self) -> list[str] | None:
        values = [
            value.strip()
            for value in self.job_types_csv.split(",")
            if value.strip()
        ]
        return values or None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="AUTOQUIZ_AI_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
