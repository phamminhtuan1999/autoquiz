# Overview

## Current Behavior

After US-RAG-007 the AI backend can turn a prompt + schema into validated JSON via
`GenerationService`, and US-RAG-006 can retrieve a document's chunks — but nothing
generates a quiz. The `generate_regular_quiz` job type and the
`quiz_sets` / `questions` / `answer_options` tables exist (US-RAG-002) yet have no
producer; the registered handler is a `NotImplementedError` stub. The live app
still generates quizzes via the legacy direct-Gemini server action with no
source grounding.

## Target Behavior

A backend `generate_regular_quiz` job handler turns a **ready** document into a
normalized, **source-cited** multiple-choice quiz:

- Load the document's retrieval chunks (ordered, bounded) as grounding context.
- Generate MCQs through the US-RAG-007 `GenerationService` against a per-request
  JSON schema; each question cites a chunk by its 1-based position.
- Enforce the citation contract: a question is persisted only if its citation
  resolves to a chunk that was in the provided context; the resolved chunk's id,
  page range, and a short excerpt are stored on the question
  (`lean-rag-mvp.md` Core Flow step 8).
- Persist a `quiz_set` (mode `regular`, linked to the document + job) with its
  `questions` and `answer_options` (4 per MCQ, one correct).
- Return the `quiz_set_id` + count so the job completes and the web can render it.

## Affected Users

- Student (document owner) — uploaded, indexed documents become real, grounded
  quizzes instead of ungrounded prompt output.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow 7–8, `regular` generation mode)
- `docs/product/rag-data-model.md` (`quiz_sets` / `questions` / `answer_options`)
- `docs/product/ai-provider-strategy.md` (cite a chunk from retrieval context)

## Non-Goals

- **Quiz-taking UI migration** (the web "generate quiz" trigger + cited
  quiz-taking view + `rag_question_attempts` recording) — deferred to a
  follow-up slice (US-RAG-008b). This story is the backend producer only.
- Cram / study-review / mock generation (US-RAG-009/010/012).
- Credit spend/refund on generation (US-RAG-011) — `credit_cost` is recorded as
  0 here.
- Query-targeted retrieval for quiz scope; this story grounds on the document's
  chunks directly (the same-space query `Retriever` is used by later modes).
- Reranking, duplicate-question suppression, and the evaluation gate
  (US-RAG-013).
