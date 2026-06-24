from __future__ import annotations

import unittest

from app.embeddings import (
    GeminiEmbeddingProvider,
    OpenAIEmbeddingProvider,
    build_embedding_provider,
    to_pgvector,
)


class _Settings:
    def __init__(self, provider: str) -> None:
        self.embedding_provider = provider
        self.openai_api_key = "openai-key"
        self.openai_embedding_model = "text-embedding-3-small"
        self.gemini_api_key = "gemini-key"
        self.gemini_embedding_model = "gemini-embedding-001"


class EmbeddingsTest(unittest.TestCase):
    def test_to_pgvector_formats_literal(self) -> None:
        self.assertEqual(to_pgvector([0.1, 0.2, 0.3]), "[0.1,0.2,0.3]")
        self.assertEqual(to_pgvector([1, 2]), "[1.0,2.0]")

    def test_factory_selects_openai(self) -> None:
        provider = build_embedding_provider(_Settings("openai"))
        self.assertIsInstance(provider, OpenAIEmbeddingProvider)
        self.assertEqual(provider.dimension, 1536)
        self.assertEqual(provider.target_table, "chunk_embeddings_openai")

    def test_factory_selects_gemini(self) -> None:
        provider = build_embedding_provider(_Settings("gemini"))
        self.assertIsInstance(provider, GeminiEmbeddingProvider)
        self.assertEqual(provider.dimension, 3072)
        self.assertEqual(provider.target_table, "chunk_embeddings_gemini")

    def test_factory_rejects_unknown(self) -> None:
        with self.assertRaises(ValueError):
            build_embedding_provider(_Settings("cohere"))

    def test_empty_input_makes_no_request(self) -> None:
        # No network: empty input short-circuits before any HTTP call.
        self.assertEqual(OpenAIEmbeddingProvider(api_key="x").embed([]), [])
        self.assertEqual(GeminiEmbeddingProvider(api_key="x").embed([]), [])


if __name__ == "__main__":
    unittest.main()
