# Exec Plan

## Goal

A backend `generate_cram` job handler that turns a ready document into a
normalized, source-cited flashcard `quiz_set` (mode `cram`) + `questions`
(`type='flashcard'`), built on the US-RAG-006 chunks and the US-RAG-007
generation service. Mirrors US-RAG-008.

## Scope

In scope:

- `GenerateCramHandler` + domain (`GeneratedCard`; reuse `SourceChunk`),
  prompt + per-request `cram_schema`, citation validation/mapping.
- `SupabaseQuizStore.save_cards` (no `answer_options`); reuse `create_quiz_set`
  and `SupabaseChunkSource`.
- Register `generate_cram` in `DEFAULT_HANDLERS` (replace the stub).
- Unit tests (fakes) + one live-Gemini + live-Supabase E2E.

Out of scope:

- Cram rapid-review web UI (trigger, cited flashcard view, attempt recording)
  → later web slice.
- Regular / study-review / mock generation; credit spend/refund; dedup; eval.

## Risk Classification

Risk flags:

- Data model (writes `quiz_sets`/`questions`).
- External systems (OpenAI/Gemini generation).
- Public contracts (the generation→cram contract the web will consume).
- Existing behavior (new grounded path beside the legacy direct-Gemini cram
  action).
- Weak proof (no prior cram-persistence tests; mitigated by seam + unit +
  live E2E).

Hard gates:

- Data model: additive writes only — **no migration, no deletion**; tables
  already shipped and validated in US-RAG-002. No legacy data touched.
- External provider behavior: covered by the live-Gemini E2E + fake-provider
  unit tests.

## Work Phases

1. Discovery — read product contracts, schema DDL, US-RAG-008 handler + IO.
2. Design — handler, seams, flashcard citation contract (this packet).
3. Validation planning — `validation.md`.
4. Implementation — `app/jobs/generate_cram.py`, `save_cards`, registration.
5. Verification — unit suite green; live E2E writes a cited cram set; teardown.
6. Harness update — `story add US-RAG-009`, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- The slice would have to include the cram web UI (separate slice).
- Credit spend/refund semantics would need to change here (US-RAG-011).
- The citation contract would have to weaken (persist a card whose source is not
  in the retrieved context).
- A schema change or legacy-data migration becomes necessary.
