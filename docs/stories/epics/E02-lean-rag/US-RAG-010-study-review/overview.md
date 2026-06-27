# Overview

## Current Behavior

After US-RAG-008/009 the AI backend turns a ready document into normalized,
source-cited **regular** MCQ and **cram** flashcard `quiz_set`s, and the web
records each answered question into `rag_question_attempts` (US-RAG-008b). The
`generate_study_review` job type exists (US-RAG-002) and is allowed by the
`ai_jobs.job_type` and `quiz_sets.mode` constraints, but its handler is a
`NotImplementedError` stub — nothing turns those attempts into a review. The
`study_reviews` table is shipped and empty.

## Target Behavior

A backend `generate_study_review` job handler turns a student's **RAG attempts**
plus the document's **source evidence** into a normalized, **source-cited**
study review:

- Load the user's `rag_question_attempts` for the document (optionally narrowed
  to one completed source set), enriched with each question's topic, prompt, and
  correctness — the weak-area signal.
- Load the document's retrieval chunks (ordered, bounded) as grounding evidence.
- Generate the review through the US-RAG-007 `GenerationService` against a
  per-request JSON schema: an overall `summary`, `weak_topics` (each grounded in
  a source chunk by its 1-based position), and `recommended_actions`.
- Enforce the citation contract on review items: a weak topic is persisted only
  if its citation resolves to a chunk that was in the provided context; the
  resolved chunk's id, page range, and a short excerpt are stored on it
  (`lean-rag-mvp.md` Core Flow step 8). A student who answered everything
  correctly yields an empty `weak_topics` and a positive summary — that is a
  valid review, not a failure.
- Persist a `quiz_set` (mode `study_review`, linked to the document + job) and a
  `study_reviews` row (`summary`, `weak_topics`, `recommended_actions` JSON)
  keyed to that set.
- Return the `quiz_set_id` + counts so the job completes and the web can render
  it.

## Affected Users

- Student (document owner) — completed quizzes turn into a grounded weak-topic
  review with concrete next actions, instead of nothing.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow 7–8, `study_review` generation mode)
- `docs/product/rag-data-model.md` (`quiz_sets` mode `study_review`,
  `study_reviews` summary / weak topics / recommended actions)
- `docs/product/ai-provider-strategy.md` (cite a chunk from retrieval context)
- `docs/product/rag-clean-cutover.md` (step 7 — RAG study review from attempts)

## Non-Goals

- **Study-review UI** (the web "generate review" trigger + the rendered review
  view) — deferred to a follow-up web slice. This story is the backend producer
  only.
- Regular / cram / mock generation (US-RAG-008/009/012).
- Credit spend/refund on generation (US-RAG-011) — `credit_cost` is recorded as
  0 here.
- Spaced-repetition scheduling, mastery tracking over time, or AI Tutor Chat.
- Reranking and the evaluation gate (US-RAG-013).
