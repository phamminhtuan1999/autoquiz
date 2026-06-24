# Overview

## Current Behavior

US-RAG-008 added a backend `generate_regular_quiz` producer that turns a ready,
indexed document into a normalized, source-cited `quiz_set` + `questions` +
`answer_options`. But **nothing on the web consumes it**: the live "generate
quiz" path is the legacy synchronous Gemini server action
(`apps/web/src/actions/generate-quiz.ts`) writing ungrounded `QuizQuestion[]`
JSONB into the legacy `quizzes` table; quiz-taking reads that table and records
answers to `question_attempts` by `(quiz_id, question_index)`. No web code reads
`quiz_sets` / `questions` / `answer_options`, and no source citations are shown.

A presentational quiz component library exists under
`apps/web/src/components/quiz/` (`QuestionCard`, `SourceRef`, `DifficultyChip`,
…) using DESIGN.md tokens, but it is **unwired** — imported by nothing.

## Target Behavior

The web app can generate and take a **source-grounded, cited** quiz from a ready
document, end to end:

- From a `ready` document, a student triggers generation. The web enqueues a
  `generate_regular_quiz` `ai_jobs` row (same enqueue+poll pattern as
  `process_document`) and polls until the job succeeds, then links to the quiz.
- A cited quiz player renders the resulting `quiz_set` by reading `questions` +
  `answer_options`, showing each question's options, its source citation (page
  range + excerpt via `SourceRef`), and its explanation after answering.
- Each answer is recorded to `rag_question_attempts`
  (`question_id`, `quiz_set_id`, `selected_option_id`, `is_correct`), the RAG
  attempt table that runs beside the legacy `question_attempts` during cutover.

## Affected Users

- Student (document owner) — uploaded, indexed documents become real, cited
  quizzes they can take, instead of ungrounded one-shot Gemini output.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow 7–9: generate → take → cite)
- `docs/product/rag-data-model.md` (`quiz_sets` / `questions` / `answer_options`
  / `rag_question_attempts`)
- `docs/product/ai-provider-strategy.md` (citations surfaced in the UI)

## Non-Goals

- **Retiring the legacy path.** The legacy `quizzes` / `question_attempts` flow
  and the `generate-quiz.ts` action stay in place (coexistence) — the schema
  itself notes the legacy attempt table "remains in place during clean cutover."
  Retirement is a later cleanup story.
- Cram / study-review / mock taking UIs (US-RAG-009/010/012 + their web slices).
- Credit spend/refund on RAG generation (US-RAG-011) — the job records
  `credit_cost=0`; this slice does not deduct credits.
- Question editing / approval / regeneration (the `QuestionCard` "review" mode).
- Document-text picker rework in the legacy `generate-wizard.tsx`.
