# Overview

## Current Behavior

After US-RAG-008 the AI backend turns a ready document into a normalized,
source-cited **regular** MCQ `quiz_set`. The `generate_cram` job type exists
(US-RAG-002) and is allowed by the `ai_jobs.job_type` and `quiz_sets.mode`
constraints, but its handler is a `NotImplementedError` stub — nothing produces
a cram set. The live app still generates cram content via the legacy
direct-Gemini server action (`apps/web/src/actions/generate-cram.ts`) into an
ad-hoc shape with no source grounding.

## Target Behavior

A backend `generate_cram` job handler turns a **ready** document into a
normalized, **source-cited** rapid-review flashcard set:

- Load the document's retrieval chunks (ordered, bounded) as grounding context.
- Generate flashcards through the US-RAG-007 `GenerationService` against a
  per-request JSON schema; each card cites a chunk by its 1-based position.
- Enforce the citation contract: a card is persisted only if its citation
  resolves to a chunk that was in the provided context; the resolved chunk's id,
  page range, and a short excerpt are stored on the card
  (`lean-rag-mvp.md` Core Flow step 8).
- Persist a `quiz_set` (mode `cram`, linked to the document + job) with its
  `questions` (`type='flashcard'`, front = `prompt`, back = `correct_answer`).
  Flashcards have no `answer_options`.
- Return the `quiz_set_id` + count so the job completes and the web can render it.

## Affected Users

- Student (document owner) — uploaded, indexed documents become real, grounded
  rapid-review cram decks instead of ungrounded prompt output.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow 7–8, `cram` generation mode)
- `docs/product/rag-data-model.md` (`quiz_sets` mode `cram`, `questions`
  type `flashcard`)
- `docs/product/ai-provider-strategy.md` (cite a chunk from retrieval context)

## Non-Goals

- **Cram rapid-review UI** (the web "generate cram" trigger + cited flashcard
  review view + attempt recording) — deferred to a follow-up web slice. This
  story is the backend producer only.
- Regular / study-review / mock generation (US-RAG-008/010/012).
- Credit spend/refund on generation (US-RAG-011) — `credit_cost` is recorded as
  0 here.
- Query-targeted retrieval for cram scope; this story grounds on the document's
  chunks directly (the same-space query `Retriever` is used by later modes).
- Reranking, duplicate-card suppression, and the evaluation gate (US-RAG-013).
