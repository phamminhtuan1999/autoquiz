# Overview

## Current Behavior

The web app has no persisted document corpus surface. The only PDF entry point
is the public landing `PdfUploader`, which extracts text in the browser and
calls a direct Gemini generation action; it never writes to the `documents`
storage bucket, never creates a `documents` row, and never enqueues an
`ai_jobs` record. The RAG foundation (US-RAG-002 schema/storage/RLS, US-RAG-003
job table and claim protocol) exists in the database but has no web-facing
producer.

## Target Behavior

Signed-in users have a documents area at `/dashboard/documents` where they can:

- Upload a PDF, which is stored in the private `documents` bucket at
  `<user_id>/<document_id>/<original_filename>`.
- See a `documents` row created with `status = 'uploaded'` and a matching
  `process_document` `ai_jobs` row created with `status = 'queued'` and
  `input = { document_id, storage_path }`.
- See a live list of their documents with a status badge that reflects the
  `documents.status` state machine (`uploaded → processing → ready` / `failed`
  / `unsupported`) plus job `progress` and `current_step` while processing.
- See clear errors for oversized or non-PDF files and for failed processing.
- Delete a document (removes the stored object and the `documents` row).

The web app only **reads** processing status; it never writes
`ai_jobs.status` or `documents.status`. Those transitions belong to the Python
worker (US-RAG-005+).

## Affected Users

- Student (signed-in document owner).

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow steps 1–3)
- `docs/product/rag-data-model.md` (storage + documents + ai_jobs contract)

## Non-Goals

- Docling extraction, page persistence, or chunking (US-RAG-005).
- Embedding generation or retrieval (US-RAG-006).
- Rewiring quiz/cram/mock generation to the RAG path (US-RAG-008+).
- Credit spend/refund on upload or processing (US-RAG-011).
- Restyling or retiring the legacy landing `PdfUploader` (folds into US-RAG-008).
- Any write to `ai_jobs.status` / `documents.status` from the web app.
