# Exec Plan

## Goal

A backend `generate_mock_exam` job handler that turns a ready document into a
normalized, source-cited, timed mock `quiz_set` (mode `mock`) of MCQ
(`type='mcq'` + `answer_options`) and essay (`type='essay'`, rubric in
`metadata`) questions, built on the US-RAG-006 chunks and the US-RAG-007
generation service. Mirrors US-RAG-008/009/010.

## Scope

In scope:

- `GenerateMockExamHandler` + domain (`GeneratedEssay`; reuse `SourceChunk` /
  `GeneratedQuestion`), prompt + per-request `mock_schema`, citation
  validation/mapping for both question kinds.
- `SupabaseQuizStore.save_essays` (`type='essay'`, rubric metadata, no options);
  reuse `save_questions`, `create_quiz_set`, `SupabaseChunkSource`.
- Register `generate_mock_exam` in `DEFAULT_HANDLERS` (replace the stub).
- Decision 0012 (rubric storage). Unit tests (fakes) + one live-Gemini +
  live-Supabase E2E.

Out of scope:

- Mock-exam session / taking / grading UI (timer, essay grading) → later web
  slice; retiring legacy mock routes.
- Multi-document exams; regular / cram / study-review generation; credit
  spend/refund; dedup; eval.

## Risk Classification

Risk flags:

- Data model (writes `quiz_sets`/`questions`/`answer_options`; essay rubric in
  `metadata`).
- External systems (OpenAI/Gemini generation).
- Public contracts (the mock generation contract a later session UI consumes).
- Existing behavior (new grounded path beside the legacy direct-Gemini mock
  action + `mock_exams` table).
- Weak proof (no prior mock-persistence tests; mitigated by seam + unit + live
  E2E).

Hard gates:

- Data model: additive writes only — **no migration, no deletion**; tables
  already shipped and validated in US-RAG-002. Legacy `mock_exams` untouched.
  Rubric storage resolved by decision 0012.
- External provider behavior: covered by the live-Gemini E2E + fake-provider
  unit tests.

References decisions `0009`, `0010`, and `0012`.

## Work Phases

1. Discovery — read product contracts, schema DDL, legacy mock action,
   US-RAG-008/009/010 handler + IO.
2. Design — handler, seams, MCQ+essay citation contract, rubric storage decision
   (this packet + 0012).
3. Validation planning — `validation.md`.
4. Implementation — `app/jobs/generate_mock_exam.py`, `save_essays`,
   registration.
5. Verification — unit suite green; live E2E writes a cited mock set; teardown.
6. Harness update — `story add US-RAG-012`, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- The slice would have to include the mock session / grading UI (separate slice).
- Credit spend/refund semantics would need to change here (US-RAG-011).
- The citation contract would have to weaken (persist a question whose source is
  not in the retrieved context).
- Rubric storage would need a dedicated table / schema change (revisit 0012).
