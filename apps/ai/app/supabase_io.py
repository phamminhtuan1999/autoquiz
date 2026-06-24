"""US-RAG-005: Supabase Storage download + PostgREST writes for extraction.

Uses the same SDK-free ``urllib`` pattern as the job repository (US-RAG-003).
All requests use the service-role key, which bypasses RLS — so every written row
must carry the correct ``user_id`` (the document owner).
"""

from __future__ import annotations

import json
from urllib import error, request

from app.embeddings import to_pgvector


class SupabaseHttpError(RuntimeError):
    pass


def _auth_headers(service_role_key: str) -> dict[str, str]:
    return {
        "apikey": service_role_key,
        "authorization": f"Bearer {service_role_key}",
    }


class SupabaseStorageDownloader:
    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        bucket: str = "documents",
        timeout_seconds: int = 60,
    ) -> None:
        self.base = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.bucket = bucket
        self.timeout_seconds = timeout_seconds

    def download(self, storage_path: str) -> bytes:
        url = f"{self.base}/storage/v1/object/{self.bucket}/{storage_path}"
        req = request.Request(url, method="GET", headers=_auth_headers(self.service_role_key))
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                return response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SupabaseHttpError(f"storage download failed ({exc.code}): {detail}") from exc
        except error.URLError as exc:
            raise SupabaseHttpError(str(exc.reason)) from exc


class SupabaseDocumentStore:
    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        timeout_seconds: int = 30,
    ) -> None:
        self.base = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout_seconds = timeout_seconds

    # --- document status transitions ---

    def mark_processing(self, document_id: str, user_id: str) -> None:
        self._patch_document(document_id, {"status": "processing", "processing_error": None})

    def mark_ready(
        self,
        document_id: str,
        user_id: str,
        *,
        page_count: int,
        embedding_provider: str | None = None,
        embedding_model: str | None = None,
    ) -> None:
        patch = {"status": "ready", "page_count": page_count, "processing_error": None}
        if embedding_provider is not None:
            patch["embedding_provider"] = embedding_provider
        if embedding_model is not None:
            patch["embedding_model"] = embedding_model
        self._patch_document(document_id, patch)

    def mark_unsupported(self, document_id: str, user_id: str, *, reason: str) -> None:
        self._patch_document(document_id, {"status": "unsupported", "processing_error": reason})

    def mark_failed(self, document_id: str, user_id: str, *, error: str) -> None:
        self._patch_document(document_id, {"status": "failed", "processing_error": error})

    # --- page / chunk persistence (idempotent upserts) ---

    def save_pages(self, document_id: str, user_id: str, pages) -> None:
        rows = [
            {
                "user_id": user_id,
                "document_id": document_id,
                "page_number": page.page_number,
                "raw_text": page.raw_text,
                "cleaned_text": page.cleaned_text,
                "char_count": page.char_count,
            }
            for page in pages
        ]
        if rows:
            self._upsert("document_pages", rows, on_conflict="document_id,page_number")

    def save_chunks(self, document_id: str, user_id: str, chunks) -> None:
        rows = [
            {
                "user_id": user_id,
                "document_id": document_id,
                "chunk_index": chunk.chunk_index,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
                "heading": chunk.heading,
                "content": chunk.content,
                "token_count": chunk.token_count,
                "metadata": chunk.metadata or {},
            }
            for chunk in chunks
        ]
        if rows:
            self._upsert("document_chunks", rows, on_conflict="document_id,chunk_index")

    def save_embeddings(
        self,
        document_id: str,
        user_id: str,
        *,
        provider: str,
        model: str,
        target_table: str,
        embeddings_by_index: dict[int, list[float]],
    ) -> None:
        if not embeddings_by_index:
            return
        # Resolve chunk_index -> chunk_id from the just-written chunks (survives
        # upsert re-runs; keeps save_chunks' signature unchanged).
        chunks = self._get(
            f"{self.base}/rest/v1/document_chunks"
            f"?document_id=eq.{document_id}&select=id,chunk_index"
        )
        id_by_index = {int(row["chunk_index"]): row["id"] for row in chunks}
        rows = []
        for index, vector in embeddings_by_index.items():
            chunk_id = id_by_index.get(int(index))
            if chunk_id is None:
                continue
            rows.append(
                {
                    "user_id": user_id,
                    "chunk_id": chunk_id,
                    "provider": provider,
                    "model": model,
                    "embedding": to_pgvector(vector),
                }
            )
        if rows:
            self._upsert(target_table, rows, on_conflict="chunk_id,provider,model")

    # --- HTTP ---

    def _get(self, url: str) -> list[dict]:
        req = request.Request(url, method="GET", headers=_auth_headers(self.service_role_key))
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8") or "[]")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SupabaseHttpError(f"GET {url} failed ({exc.code}): {detail}") from exc
        except error.URLError as exc:
            raise SupabaseHttpError(str(exc.reason)) from exc

    def _patch_document(self, document_id: str, patch: dict) -> None:
        url = f"{self.base}/rest/v1/documents?id=eq.{document_id}"
        self._send(url, "PATCH", patch, prefer="return=minimal")

    def _upsert(self, table: str, rows: list[dict], *, on_conflict: str) -> None:
        url = f"{self.base}/rest/v1/{table}?on_conflict={on_conflict}"
        self._send(url, "POST", rows, prefer="resolution=merge-duplicates,return=minimal")

    def _send(self, url: str, method: str, payload, *, prefer: str) -> None:
        body = json.dumps(payload).encode("utf-8")
        headers = {
            **_auth_headers(self.service_role_key),
            "content-type": "application/json",
            "prefer": prefer,
        }
        req = request.Request(url, data=body, method=method, headers=headers)
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SupabaseHttpError(f"{method} {url} failed ({exc.code}): {detail}") from exc
        except error.URLError as exc:
            raise SupabaseHttpError(str(exc.reason)) from exc
