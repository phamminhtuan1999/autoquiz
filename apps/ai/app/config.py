from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AutoQuiz AI"
    environment: str = "development"
    supabase_url: str = "http://localhost:54321"
    supabase_service_role_key: str = ""
    worker_id: str = "autoquiz-ai-local"
    job_types_csv: str = ""

    # US-RAG-006: embedding providers. Active provider defaults to the product
    # primary (OpenAI); Gemini is the dev/fallback provider.
    embedding_provider: str = "openai"
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    gemini_api_key: str = ""
    gemini_embedding_model: str = "gemini-embedding-001"

    # US-RAG-007: generation providers. Primary defaults to the product primary
    # (OpenAI); Gemini is the fallback. Keys reuse the embedding key fields.
    generation_provider: str = "openai"
    generation_fallback_provider: str = "gemini"
    openai_chat_model: str = "gpt-4o-mini"
    # gemini-2.5-flash: verified to have free-tier generateContent quota for the
    # dev/fallback path (gemini-2.0-flash returns limit:0 on the free tier).
    gemini_chat_model: str = "gemini-2.5-flash"

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
