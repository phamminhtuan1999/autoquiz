# Validation

## Proof Strategy

This is a UI slice, so the proof is **runtime observation in the browser**: build
the web app, run it with the AI worker, drive the real flow (generate → take →
record) as the test user, and capture what renders + what lands in the database.
A production build / typecheck guards the contract; the browser run proves it
works end to end.

## Test Plan

| Layer | Cases |
| --- | --- |
| Build/Types | `pnpm --filter web build` (or `next build`) compiles; no type errors in the new action/route/components. |
| Enqueue | `enqueueQuizGeneration` inserts an `ai_jobs` row (`job_type=generate_regular_quiz`, `input.document_id`, status `queued`) for a `ready`, owned document; rejects a non-ready or non-owned document. |
| Generate (E2E) | Clicking "Generate quiz" on a ready document enqueues the job; with the worker running, the control polls to `succeeded` and links to the player. |
| Player (E2E) | `/dashboard/quiz-sets/[quizSetId]` renders the cited questions: options selectable, correct/incorrect revealed on answer, explanation + `SourceRef` (page + excerpt) shown, final score tallied. DESIGN.md tokens, no emoji, Sora/Plus-Jakarta fonts. |
| Record (E2E) | Answering a question writes a `rag_question_attempts` row (`question_id`, `quiz_set_id`, `selected_option_id`, `is_correct`) for the user. |
| Coexistence | The legacy `quizzes` quiz-taking route and `question_attempts` recording still work and are untouched. |

## Fixtures

- Test account (`phamminhtuan1999@gmail.com`).
- A `ready`, indexed document for that user (chunks present). If none exists, a
  real cited `quiz_set` is seeded directly for the player/record verification,
  and the enqueue+worker path is driven separately.
- The AI worker running against the shared Supabase project for the live
  generate path.

## Commands

```text
pnpm --filter web build          # contract / type guard
# dev server via preview tooling; AI worker: python3 -m app.worker (apps/ai)
```

## Acceptance Evidence

Verified 2026-06-24 (browser runtime, dev server + test account
`phamminhtuan1999@gmail.com`, live Supabase + Gemini).

- **Types**: `tsc --noEmit -p apps/web` → no errors (the embedded
  `answer_options(...)` join required a cast through `unknown`).
- **Generate trigger**: seeded a ready document for the test user → the
  documents panel rendered the row with a green **Ready** badge and the new
  **Generate quiz** control (Sparkles icon, accent tokens, Plus Jakarta Sans).
  Clicking it inserted an `ai_jobs` row (`job_type=generate_regular_quiz`,
  status `queued`, `input={document_id, num_questions:5, difficulty:"medium"}`)
  and the control switched to "Generating quiz…".
- **Poll → link**: ran the real US-RAG-008 handler against that job (claim/
  complete proven in US-RAG-003) → `quiz_set` with 5 cited questions; the
  control polled to success and rendered a **Take quiz →** link to
  `/dashboard/quiz-sets/<id>`.
- **Cited player**: the route rendered the eyebrow, Sora heading
  "5-question quiz (medium)", a progress bar, and 5 questions each with a mono
  index, amber **Medium** chip, topic, a **p.1** `SourceRef` chip (info tokens),
  the prompt, and 4 options A–D — DESIGN.md tokens, Sora/Plus-Jakarta fonts, no
  emoji, no `slate-*`.
- **Answer reveal**: answering a question locked the options and revealed the
  result — chosen-wrong = danger bg `#fef2f2` + red text `#dc2626` + an X icon;
  correct = success bg `#f0fdf4` + green text `#15803d` + a check; others muted;
  the explanation and the progress bar updated ("1/5 answered"). (The
  `transition-colors` tween is frozen by the headless preview renderer; the
  final computed styles and a transition-disabled screenshot confirm the true
  state a real browser paints.)
- **Attempt recording**: each answer wrote a `rag_question_attempts` row
  (`question_id`, `quiz_set_id`, `selected_option_id` → option A "Glucose",
  `is_correct=false`) — verified by resolving the stored option back to its
  label/content.
- **Coexistence**: the legacy `quizzes` / `question_attempts` path and
  `generate-quiz.ts` were not touched; the empty-state documents page still
  renders.
- **Known limitation**: the `SourceRef` HeroUI popover overlay (a pre-existing
  component) did not open under headless programmatic click; the chip and its
  underlying citation data (page + persisted `source_excerpt`) are verified.
- Seeded fixtures (document, chunks, quiz_set, questions, options, attempts,
  job) torn down after verification.
