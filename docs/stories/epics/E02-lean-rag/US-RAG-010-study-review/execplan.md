# Exec Plan

## Goal

A backend `generate_study_review` job handler that turns a student's RAG
attempts + the document's source evidence into a normalized, source-cited
`study_reviews` row keyed to a `quiz_set` (mode `study_review`), built on the
US-RAG-006 chunks, the US-RAG-007 generation service, and the US-RAG-008b
attempts. Mirrors US-RAG-008/009.

## Scope

In scope:

- `GenerateStudyReviewHandler` + domain (`AttemptRecord`, `WeakTopic`,
  `StudyReview`; reuse `SourceChunk`/`ChunkSource`), prompt + per-request
  `study_review_schema`, weak-topic citation validation/mapping.
- `SupabaseAttemptSource` (attempts ⨝ questions read) and
  `SupabaseQuizStore.save_study_review` (writes `study_reviews`); reuse
  `create_quiz_set` and `SupabaseChunkSource`.
- Register `generate_study_review` in `DEFAULT_HANDLERS` (replace the stub).
- Unit tests (fakes) + one live-Gemini + live-Supabase E2E.

Out of scope:

- Study-review web UI (trigger, rendered review) → later web slice.
- Regular / cram / mock generation; credit spend/refund; mastery-over-time;
  dedup; eval.

## Risk Classification

Risk flags:

- Data model (writes `quiz_sets`/`study_reviews`; reads `rag_question_attempts`
  ⨝ `questions`).
- External systems (OpenAI/Gemini generation).
- Public contracts (the attempts→review contract the web will consume).
- Weak proof (no prior study-review tests; mitigated by seam + unit + live E2E).

Hard gates:

- Data model: additive writes only — **no migration, no deletion**; tables
  already shipped and validated in US-RAG-002. No legacy data touched.
- External provider behavior: covered by the live-Gemini E2E + fake-provider
  unit tests.

References decisions `0009-lean-rag-mvp-architecture` and
`0010-rag-repo-split-clean-cutover`; this story implements an already-decided
contract (no new decision record, matching US-RAG-009).

## Work Phases

1. Discovery — read product contracts, schema DDL, US-RAG-008/009 handler + IO,
   attempts table.
2. Design — handler, seams, weak-topic citation contract (this packet).
3. Validation planning — `validation.md`.
4. Implementation — `app/jobs/generate_study_review.py`, `SupabaseAttemptSource`,
   `save_study_review`, registration.
5. Verification — unit suite green; live E2E writes a cited review; teardown.
6. Harness update — `story add US-RAG-010`, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- The slice would have to include the study-review web UI (separate slice).
- Credit spend/refund semantics would need to change here (US-RAG-011).
- The citation contract would have to weaken (persist a weak topic whose source
  is not in the retrieved context).
- A schema change or legacy-data migration becomes necessary.
