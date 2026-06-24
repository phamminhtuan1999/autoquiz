# Exec Plan

## Goal

Surface the US-RAG-008 backend on the web: trigger `generate_regular_quiz` from
a ready document, render the resulting cited `quiz_set`, and record attempts to
`rag_question_attempts` — beside (not replacing) the legacy quiz path.

## Scope

In scope:

- `enqueueQuizGeneration` server action (validate ready + owned; insert
  `ai_jobs`).
- `GenerateQuizControl` client component (enqueue + poll + link), wired into the
  documents panel for `ready` rows.
- `/dashboard/quiz-sets/[quizSetId]` server route + `RagQuizPlayer` client
  component (cited, interactive, scored).
- `recordRagAttempt` client action → `rag_question_attempts`.
- Reuse `SourceRef` / `DifficultyChip`.

Out of scope:

- Retiring legacy `quizzes` / `question_attempts` / `generate-quiz.ts`.
- Cram / study-review / mock taking UIs; credit spend (US-RAG-011); question
  review/edit mode; legacy wizard rework.

## Risk Classification

Risk flags: data-model (writes `ai_jobs`, `rag_question_attempts`), external
systems (the job runs the AI provider), public contracts (the generation→quiz
contract the UI now consumes), cross-platform (web UI), existing behavior (new
path beside the legacy quiz flow), weak proof (no prior RAG quiz-taking UI).

Hard gates:

- Existing behavior: **additive only** — the legacy path is untouched; the new
  surface is new routes/components + a separate attempt table.
- Data model: no schema change; reads RAG tables, writes `ai_jobs` +
  `rag_question_attempts` (both shipped in US-RAG-002), all RLS-scoped.

## Work Phases

1. Discovery — map the legacy + RAG surfaces, enqueue/poll pattern, tokens, RAG
   table columns (done).
2. Design — surfaces, data flow, coexistence (this packet).
3. Validation planning — `validation.md`.
4. Implementation — action + control + route + player + attempt action; wire
   the control into the documents panel.
5. Verification — `next build`/typecheck green; **browser visual verification**
   with the dev server + the AI worker: log in (test account), generate from a
   ready document, take the cited quiz, confirm a `rag_question_attempts` row.
6. Harness update — `story add US-RAG-008b`, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- Surfacing would require retiring or changing the legacy quiz path.
- Credit deduction would have to happen here (US-RAG-011).
- A schema change becomes necessary to render citations or record attempts.
- RLS would have to be bypassed (service-role) to read or write quiz data.
