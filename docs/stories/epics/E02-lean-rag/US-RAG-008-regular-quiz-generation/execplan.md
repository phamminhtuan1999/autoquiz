# Exec Plan

## Goal

A backend `generate_regular_quiz` job handler that turns a ready document into a
normalized, source-cited MCQ `quiz_set` + `questions` + `answer_options`, built
on the US-RAG-006 chunks and the US-RAG-007 generation service.

## Scope

In scope:

- `GenerateRegularQuizHandler` + domain (`SourceChunk`, `GeneratedQuestion`),
  prompt + per-request `quiz_schema`, citation validation/mapping.
- `SupabaseChunkSource` + `SupabaseQuizStore` (+ `_post_returning` helper).
- Register `generate_regular_quiz` in `DEFAULT_HANDLERS`.
- Unit tests (fakes) + one live-Gemini + live-Supabase E2E.

Out of scope:

- Web quiz-taking migration (trigger UI, cited player, `rag_question_attempts`)
  → US-RAG-008b.
- Cram / study-review / mock generation; credit spend/refund; dedup; eval gate.

## Risk Classification

Risk flags:

- Data model (writes `quiz_sets`/`questions`/`answer_options`).
- External systems (OpenAI/Gemini generation).
- Public contracts (the generation→quiz contract the web will consume).
- Existing behavior (new grounded path beside the legacy direct-Gemini action).
- Weak proof (no prior generation-persistence tests; mitigated by seam + unit +
  live E2E).

Hard gates:

- Data model: additive writes only — **no migration, no deletion**; tables
  already shipped and validated in US-RAG-002. No legacy `quizzes` data touched.
- External provider behavior: covered by the live-Gemini E2E + fake-provider
  unit tests.

## Work Phases

1. Discovery — read product contracts, schema DDL, US-RAG-005/006/007 patterns.
2. Design — handler, seams, citation contract (this packet).
3. Validation planning — `validation.md`.
4. Implementation — `app/jobs/generate_quiz.py`, IO classes, handler registration.
5. Verification — unit suite green; live E2E writes a cited quiz; teardown.
6. Harness update — `story add US-RAG-008`, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- The slice would have to include the web quiz-taking migration (separate story).
- Credit spend/refund semantics would need to change here (US-RAG-011).
- The citation contract would have to weaken (persist a question whose source is
  not in the retrieved context).
- A schema change or legacy-data migration becomes necessary.
