# Overview

## Current Behavior

US-RAG-009 ships the backend `generate_cram` handler: a ready document becomes a
normalized, source-cited flashcard `quiz_set` (mode `cram`, `questions`
`type='flashcard'`). US-RAG-008b ships the web path for **regular** quizzes — a
per-document "Generate quiz" trigger, an `ai_jobs` enqueue + poll, a cited MCQ
player, and attempt recording. But **cram has no web surface**: nothing enqueues
a `generate_cram` job and the player route only renders MCQs. The live app still
produces cram via the legacy direct-Gemini `generate-cram.ts` into browser
session storage, ungrounded.

## Target Behavior

Wire the shipped cram backend into the UI, reusing the US-RAG-008b pattern:

- A per-ready-document **"Generate cram"** trigger that enqueues a
  `generate_cram` `ai_jobs` row and polls it to completion (the same
  enqueue+poll control as the regular trigger), then links to the cram player.
- The quiz-set player route renders a **cited flashcard player** for
  `mode='cram'` sets: one card at a time, flip to reveal the back, a source
  citation (page + excerpt) per card, and a self-rating ("Got it" / "Still
  learning") that records a `rag_question_attempts` row (US-RAG-008b table).
- Regular MCQ sets keep rendering the existing MCQ player unchanged.

## Affected Users

- Student (document owner) — indexed documents can be turned into grounded
  rapid-review flashcard decks and studied in-app, with each card citing its
  source page.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow 7–8, `cram` generation mode)
- `docs/product/rag-data-model.md` (`quiz_sets` mode `cram`, `questions`
  `type='flashcard'`, `rag_question_attempts`)
- `docs/product/rag-clean-cutover.md` (cram result page backed by `quiz_sets`)

## Non-Goals

- Retiring the legacy `generate-cram.ts` / `/dashboard/cram` session-storage
  flow — a later cutover step once this path is released (cutover sequence).
- Mock-exam and study-review web surfaces (separate slices).
- Credit spend/refund on generation (US-RAG-011) — the enqueue records
  `credit_cost=0` via the backend.
- Spaced-repetition scheduling / mastery tracking over time.
- A new attempts schema — reuses `rag_question_attempts` (US-RAG-008b);
  flashcards record `selected_option_id=null` with `is_correct` = the
  self-rating.
