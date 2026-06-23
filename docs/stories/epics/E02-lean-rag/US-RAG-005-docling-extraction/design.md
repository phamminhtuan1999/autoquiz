# Design

## Domain Model

- **ExtractedDocument** = ordered `ExtractedPage[]` + `ExtractedChunk[]`.
  - `ExtractedPage`: `page_number` (1-based), `raw_text`, `cleaned_text`,
    `char_count`.
  - `ExtractedChunk`: `chunk_index` (0-based), `page_start`, `page_end`,
    `heading?`, `content`, `token_count?`, `metadata`.
- The `process_document` AI job owns one document's extraction. Its terminal
  effect is the document `status`: `ready` (pages+chunks persisted),
  `unsupported` (validation verdict), or `failed` (exhausted transient error).

## Application Flow

`process_document(job)`:

1. `document_id`, `storage_path` ← `job.input`.
2. `store.mark_processing(document_id, user_id)`; `progress 5 "downloading"`.
3. `pdf = storage.download(storage_path)`.
4. Pre-checks: `len(pdf) > 30 MB` → `unsupported`.
5. `progress 20 "extracting"`; `doc = extractor.extract(pdf, max_pages=150)`.
6. Post-checks: `len(pages) > 150` or total `char_count == 0` (scanned / no
   text) → `unsupported`.
7. `progress 60`; `store.save_pages(...)`. `progress 75`;
   `store.save_chunks(...)`.
8. `progress 95`; `store.mark_ready(document_id, page_count=len(pages))`.
9. `return JobResult({"result": "ready", "pages": N, "chunks": M})`.

Error handling (constrained by the US-RAG-003 runner, which marks any handler
exception `retryable=True`):

- **Unsupported** is a *successful job*: set `documents.status='unsupported'`
  (+ `processing_error`) and `return JobResult({"result": "unsupported", ...})`.
  Raising would wrongly mark it retryable.
- **Transient** failures (storage/Docling/DB) `raise` so the runner requeues.
  On the final attempt (`attempt_count >= max_attempts`) the handler first sets
  `documents.status='failed'` + `processing_error` so an exhausted job does not
  leave the document stuck `processing`.

## Interface Contract

Handler signature unchanged: `process_document(job: AiJob) -> JobResult`,
registered in `DEFAULT_HANDLERS`. Collaborators are injected behind protocols
so the handler is unit-testable without Docling or the network:

- `PdfExtractor.extract(pdf: bytes, *, max_pages: int) -> ExtractedDocument`
- `StorageDownloader.download(storage_path: str) -> bytes`
- `DocumentStore.mark_processing / save_pages / save_chunks / mark_ready /
  mark_unsupported / mark_failed`
- `ProgressReporter.update_progress(job_id, progress, current_step)`

Production wiring (`build_process_document_handler(settings)`):

- `DoclingPdfExtractor` (lazy `import docling` inside `extract`, so importing the
  module never requires the heavy dependency).
- `SupabaseStorageDownloader`: `GET {url}/storage/v1/object/documents/{path}`
  with service-role auth.
- `SupabaseDocumentStore`: PostgREST `POST /rest/v1/document_pages`,
  `/document_chunks`, `PATCH /rest/v1/documents?id=eq.<id>` with service-role
  auth (bypasses RLS but writes the correct `user_id`).
- `ProgressReporter` = the worker's `SupabaseRpcJobRepository`
  (`update_ai_job_progress`).

## Data Model

No schema change. Writes use US-RAG-002 tables:

- `document_pages`: `user_id, document_id, page_number, raw_text, cleaned_text,
  char_count` (unique `(document_id, page_number)`).
- `document_chunks`: `user_id, document_id, chunk_index, page_start, page_end,
  heading, content, token_count, metadata` (unique `(document_id,
  chunk_index)`).
- `documents`: update `status`, `page_count`, `processing_error`,
  (`embedding_provider`/`embedding_model` remain null until US-RAG-006).

Re-run safety: inserts use PostgREST upsert semantics keyed on the unique
constraints so a retried job does not duplicate pages/chunks.

## UI / Platform Impact

`apps/ai` only. New modules under `apps/ai/app/` (`process_document` handler,
`extraction`, `supabase_io`). `requirements.txt` gains `docling` (+ deps). No
web changes; the existing US-RAG-004 polling UI reflects the new statuses.

## Observability

Per-stage `update_ai_job_progress` (download/extract/save/finalize), job
`output` summary (`pages`, `chunks`, `result`), and `documents.processing_error`
on unsupported/failed. The worker prints one JSON line per run.

## Alternatives Considered

1. **Mark `ready` only after embeddings (006).** Rejected for this slice
   (chosen: `ready` after extraction) so US-RAG-005 delivers a visibly complete
   upload→processing→ready loop; 006 inserts the embedding stage before the flip.
2. **Add `supabase-py`.** Rejected: kept the SDK-free raw-HTTP pattern
   US-RAG-003 established (consistency, minimal deps).
3. **Change the handler signature to inject a context.** Rejected: avoids
   touching the US-RAG-003 runner/tests; the handler builds its deps from
   settings and exposes a factory for test injection.
4. **OCR scanned PDFs.** Out of scope by product decision → `unsupported`.
