# Overview

## Current Behavior

After US-RAG-008/009/010 the AI backend turns a ready document into normalized,
source-cited **regular** MCQ, **cram** flashcard, and **study_review** sets. The
`generate_mock_exam` job type exists (US-RAG-002) and is allowed by the
`ai_jobs.job_type` and `quiz_sets.mode` constraints, but its handler is a
`NotImplementedError` stub — nothing produces a RAG mock exam. The live app still
generates mock exams via the legacy multi-PDF direct-Gemini server action
(`apps/web/src/actions/generate-mock-exam.ts`) into the legacy `mock_exams` jsonb
table, with no source grounding.

## Target Behavior

A backend `generate_mock_exam` job handler turns a **ready** document into a
normalized, **source-cited**, timed mock exam:

- Load the document's retrieval chunks (ordered, bounded) as grounding context.
- Generate a mixed exam through the US-RAG-007 `GenerationService` against a
  per-request JSON schema: **MCQ** questions (4 options + correct answer) and
  **essay** questions (a rubric of scored criteria, a max-points value, a
  suggested time, and a reference sample answer). Each question cites a chunk by
  its 1-based position.
- Enforce the citation contract: a question is persisted only if its citation
  resolves to a chunk that was in the provided context; the resolved chunk's id,
  page range, and a short excerpt are stored on it (`lean-rag-mvp.md` Core Flow
  step 8).
- Persist a `quiz_set` (mode `mock`, linked to the document + job) with its
  `questions`: MCQs as `type='mcq'` + `answer_options` (as US-RAG-008), essays
  as `type='essay'` with the rubric / max-points / suggested-minutes in
  `metadata` (decision 0012). No new table.
- Return the `quiz_set_id`, counts, and suggested `time_limit_minutes` so the job
  completes and a later session UI can render and grade it.

## Affected Users

- Student (document owner) — a ready document becomes a real, grounded, timed
  mock exam (MCQ + rubric-graded essays) instead of an ungrounded multi-PDF blob.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow 7–8, `mock` generation mode)
- `docs/product/rag-data-model.md` (`quiz_sets` mode `mock`, `questions` types
  `mcq`/`essay`)
- `docs/product/ai-provider-strategy.md` (cite a chunk from retrieval context)
- `docs/product/rag-clean-cutover.md` (step 8 — RAG mock exam, then retire legacy)
- `docs/decisions/0012-rag-mock-exam-rubric-storage.md`

## Non-Goals

- **Mock-exam session / taking / grading UI** (timer, essay submission,
  rubric-backed essay grading, results) — deferred to a later web slice. This
  story is the backend producer only; it generates the rubric, it does not grade.
- Retiring the legacy `generate-mock-exam.ts` / `mock-exam-session.ts` /
  `/dashboard/mock-exam/*` routes — happens after the RAG session UI lands.
- Multi-document exams; this slice grounds on one ready document (the RAG path
  is per-document, as US-RAG-008/009/010).
- Regular / cram / study-review generation (US-RAG-008/009/010).
- Credit spend/refund on generation (US-RAG-011) — `credit_cost` is recorded as
  0 here.
- Reranking, duplicate-question suppression, and the evaluation gate (US-RAG-013).
