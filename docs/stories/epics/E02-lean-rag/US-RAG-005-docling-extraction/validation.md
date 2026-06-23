# Validation

## Proof Strategy

The handler is decomposed behind protocols so the orchestration (validation,
status transitions, page/chunk persistence, progress, error handling) is proven
deterministically with fakes, and the real network/DB path is proven against
live Supabase with a fake extractor on a real queued job. The actual Docling
parse is proven by a documented manual run (heavy dependency, deferred per the
agreed verification depth).

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Happy path: extract→pages+chunks persisted, document `ready`, job output `{pages,chunks}`. Unsupported: empty-text and >150 pages → document `unsupported`, job succeeds (no raise). Oversize bytes → `unsupported`. Transient error on final attempt → document `failed`; on non-final attempt → re-raise without `failed`. Progress called per stage. |
| Integration | `SupabaseDocumentStore`/`SupabaseStorageDownloader` issue correct PostgREST/storage requests (URL, method, auth headers, upsert) — asserted against a stub HTTP layer. |
| E2E | Against live Supabase: upload a PDF (US-RAG-004) → run the runner with a fake extractor + real storage/store → document flips `processing→ready`, `document_pages`/`document_chunks` rows created, job `succeeded`. |
| Platform | `apps/ai` unit tests pass; module imports without `docling` installed. |
| Logs/Audit | Job progress + output recorded; `processing_error` set on unsupported/failed. |

## Fixtures

- Test account: `phamminhtuan1999@gmail.com`.
- A small real PDF uploaded through `/dashboard/documents` to create a live
  `process_document` job.
- Deterministic `FakeExtractor` returning known pages/chunks for unit + E2E.

## Commands

```text
# unit
cd apps/ai && PYTHONPATH=. python -m unittest discover -s tests -v
# (real docling, manual) pip install -r apps/ai/requirements.txt then run_once.py
```

## Acceptance Evidence

Verified 2026-06-23.

- **Unit**: `python -m unittest discover -s tests` → 11 tests pass (4 runner +
  7 new). Covers happy path (pages+chunks persisted, `ready`, progress per
  stage), unsupported (no-text, >max pages, oversize → `unsupported`, no raise,
  no persistence), and transient failure (final attempt → `failed`; non-final →
  re-raise without `failed`). Module imports without `docling` installed.
- **E2E (live Supabase, fake extractor + real IO)**: created a real `uploaded`
  document + storage object + `queued` process_document job; ran the actual
  `JobRunner` → claimed the job, downloaded the PDF from Storage, wrote
  `document_pages` `[1,2]` + a `document_chunks` row, flipped the document
  `uploaded → ready` (`page_count=2`), and `complete_ai_job` set the job
  `succeeded` / progress 100 / output `{pages:2, chunks:1, result:"ready"}`.
  Fixture torn down.
- **Wiring**: `DEFAULT_HANDLERS = {"process_document": ...}` so the `run_once`
  gate proceeds. Full `run_once.py` smoke requires
  `pip install -r apps/ai/requirements.txt` (pydantic-settings/docling) — not
  installed in this env.
- **Deferred (agreed)**: the real Docling parse — manual run after installing
  the heavy dependency. The orchestration around it is fully proven above.
