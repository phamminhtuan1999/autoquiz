# Overview

## Current Behavior

The `apps/ai` worker (US-RAG-003) can claim `process_document` jobs, report
progress, and complete/fail them, but the `process_document` handler is an
unimplemented stub and `DEFAULT_HANDLERS` is empty, so `run_once.py` exits
`not_configured` and never claims live jobs. US-RAG-004 creates real
`process_document` jobs on PDF upload, so uploaded documents sit at
`uploaded`/`queued` forever — the UI honestly shows "waiting for a processing
worker."

## Target Behavior

The `apps/ai` worker processes `process_document` jobs end to end:

1. Claim the job (existing US-RAG-003 protocol).
2. Mark the document `processing`.
3. Download the original PDF from the private `documents` storage bucket using
   `input.storage_path`.
4. Validate: oversized (> 30 MB), too long (> 150 pages), or scanned / no
   extractable text (no OCR in this pass) → mark the document `unsupported`.
5. Extract per-page text with Docling and chunk it (with source page ranges and
   token counts).
6. Persist `document_pages` and `document_chunks`.
7. Set the document `ready` and `page_count`, and complete the job.

The document `status` becomes the user-visible outcome
(`processing → ready | unsupported | failed`); the AI job records the worker
outcome. Embeddings are **not** produced here — US-RAG-006 inserts the embedding
stage into this same handler before the `ready` flip.

## Affected Users

- Student (document owner) — uploads now actually become usable.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow steps 4–6)
- `docs/product/rag-data-model.md` (document_pages, document_chunks contract)
- `docs/product/ai-provider-strategy.md` (no OCR; unsupported is non-retryable)

## Non-Goals

- Embeddings, vector index, or retrieval (US-RAG-006).
- Any generation (US-RAG-008+).
- OCR for scanned PDFs (explicit product non-goal; such PDFs → `unsupported`).
- Changing the US-RAG-003 runner/claim protocol or the handler signature.
- A long-running daemon/scheduler for the worker (still `run_once` invocation).
