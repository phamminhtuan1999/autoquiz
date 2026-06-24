"""US-RAG-006: embedding providers (OpenAI primary, Gemini dev/fallback).

SDK-free HTTP, consistent with the rest of ``apps/ai``. Each provider declares
the vector ``dimension`` and the ``target_table`` it indexes into, so a
document's index stays a single provider/model space (ai-provider-strategy).
"""

from __future__ import annotations

import json
from typing import Protocol
from urllib import error, request


class EmbeddingError(RuntimeError):
    pass


def to_pgvector(vector) -> str:
    """Serialize a float sequence to pgvector's text literal: ``[v0,v1,...]``."""
    return "[" + ",".join(str(float(x)) for x in vector) + "]"


def _post_json(url: str, payload: dict, headers: dict, timeout: int) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={"content-type": "application/json", **headers},
    )
    try:
        with request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise EmbeddingError(f"embedding request failed ({exc.code}): {detail}") from exc
    except error.URLError as exc:
        raise EmbeddingError(str(exc.reason)) from exc


class EmbeddingProvider(Protocol):
    name: str
    model: str
    dimension: int
    target_table: str

    def embed(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


class OpenAIEmbeddingProvider:
    name = "openai"
    target_table = "chunk_embeddings_openai"
    dimension = 1536

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "text-embedding-3-small",
        base_url: str = "https://api.openai.com/v1",
        timeout_seconds: int = 60,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        data = _post_json(
            f"{self.base_url}/embeddings",
            {"model": self.model, "input": list(texts)},
            {"authorization": f"Bearer {self.api_key}"},
            self.timeout_seconds,
        )
        rows = sorted(data.get("data", []), key=lambda row: row.get("index", 0))
        return [[float(x) for x in row["embedding"]] for row in rows]

    def embed_query(self, text: str) -> list[float]:
        return self.embed([text])[0]


class GeminiEmbeddingProvider:
    name = "gemini"
    target_table = "chunk_embeddings_gemini"
    dimension = 3072

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "gemini-embedding-001",
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
        timeout_seconds: int = 60,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        model_path = f"models/{self.model}"
        payload = {
            "requests": [
                {
                    "model": model_path,
                    "content": {"parts": [{"text": text}]},
                    "outputDimensionality": self.dimension,
                }
                for text in texts
            ]
        }
        data = _post_json(
            f"{self.base_url}/{model_path}:batchEmbedContents?key={self.api_key}",
            payload,
            {},
            self.timeout_seconds,
        )
        return [[float(x) for x in item["values"]] for item in data.get("embeddings", [])]

    def embed_query(self, text: str) -> list[float]:
        return self.embed([text])[0]


def build_embedding_provider(settings) -> EmbeddingProvider:
    provider = (getattr(settings, "embedding_provider", "openai") or "openai").lower()
    if provider == "gemini":
        return GeminiEmbeddingProvider(
            api_key=settings.gemini_api_key, model=settings.gemini_embedding_model
        )
    if provider == "openai":
        return OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key, model=settings.openai_embedding_model
        )
    raise ValueError(f"unknown embedding provider: {provider}")
