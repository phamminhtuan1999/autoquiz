"""US-RAG-006: same-space retrieval helper for generation (US-RAG-008).

Embeds a query with the *same* provider/model used to index the document and
calls the provider-specific ``match_document_chunks_<provider>`` RPC, which
scopes the vector search to one user's one document.
"""

from __future__ import annotations

import json
from urllib import error, request

from app.embeddings import EmbeddingProvider, to_pgvector


class RetrievalError(RuntimeError):
    pass


class Retriever:
    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        embedder: EmbeddingProvider,
        timeout_seconds: int = 30,
    ) -> None:
        self.base = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.embedder = embedder
        self.timeout_seconds = timeout_seconds

    def retrieve(
        self,
        *,
        query: str,
        document_id: str,
        user_id: str,
        match_count: int = 8,
    ) -> list[dict]:
        query_embedding = self.embedder.embed_query(query)
        return self._rpc(
            f"match_document_chunks_{self.embedder.name}",
            {
                "query_embedding": to_pgvector(query_embedding),
                "match_count": match_count,
                "p_document_id": document_id,
                "p_user_id": user_id,
            },
        )

    def _rpc(self, function_name: str, payload: dict) -> list[dict]:
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            f"{self.base}/rest/v1/rpc/{function_name}",
            data=body,
            method="POST",
            headers={
                "apikey": self.service_role_key,
                "authorization": f"Bearer {self.service_role_key}",
                "content-type": "application/json",
                "accept": "application/json",
            },
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8") or "[]")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RetrievalError(f"retrieval RPC failed ({exc.code}): {detail}") from exc
        except error.URLError as exc:
            raise RetrievalError(str(exc.reason)) from exc
