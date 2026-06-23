# Exec Plan

## Goal

Make the `apps/ai` worker turn an uploaded PDF into persisted
`document_pages` + `document_chunks` and flip the document to `ready`, closing
the upload→processing→ready loop opened by US-RAG-004.

## Scope

In scope:

- Implement `process_document(job)` and register it in `DEFAULT_HANDLERS`.
- Storage download + PostgREST document/page/chunk writes (raw-HTTP, service
  role), behind injectable protocols.
- Docling extraction + chunking behind a `PdfExtractor` seam (lazy import).
- Validation → `unsupported` (oversize, > 150 pages, scanned/no text).
- Per-stage progress; `ready`/`unsupported`/`failed` document transitions.
- `requirements.txt`: add `docling`.
- Unit tests (fake extractor/storage/store) for happy path, unsupported, and
  transient-failure document-status handling.

Out of scope:

- Embeddings, retrieval, generation (US-RAG-006+).
- OCR. Daemonizing the worker. Runner/claim-protocol changes.

## Risk Classification

Risk flags:

- External systems: Supabase Storage + PostgREST + Docling.
- Data model: writes to document_pages/document_chunks; document status.
- Authorization: service-role writes must set correct `user_id`.
- Audit/security: handles private uploaded PDF content.
- Existing behavior: activates the previously-inert worker.

Hard gates:

- External provider behavior (handled: deterministic seam + unit tests; real
  Docling run documented as a manual step).
- Data loss/migration (none: additive inserts, upsert-keyed, no deletes).

## Work Phases

1. Discovery — runner/contract/schema (done).
2. Design — this packet.
3. Validation planning — `validation.md`.
4. Implementation — handler, extraction, supabase_io, deps, register.
5. Verification — `python -m pytest`/`unittest`; E2E of the storage→DB→
   job-lifecycle path against live Supabase with a fake extractor on a real
   queued job; document the real-Docling manual run.
6. Harness update — `story add/update`, backlog, trace.

## Stop Conditions

Pause for human confirmation if:

- The worker would need a service key exposed outside `apps/ai`.
- Marking `ready` vs `processing` semantics must change (decided: `ready`).
- Validation rules (sizes, page cap, OCR) must weaken.
- A schema change becomes necessary to persist extraction output.
