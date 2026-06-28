# Design

## Component / Action Model

- **`enqueueQuizGeneration` (generalized)** — the US-RAG-008b server action gains
  a `mode: "regular" | "cram"` (default `"regular"`). It maps mode → job_type +
  input: regular → `generate_regular_quiz` `{document_id, num_questions,
  difficulty}`; cram → `generate_cram` `{document_id, num_cards, difficulty}`.
  Auth + ready-document ownership checks are unchanged. Backward compatible: the
  existing regular caller passes no mode.
- **`GenerateQuizControl` (generalized)** — gains a `mode: "regular" | "cram"`
  prop (default `"regular"`). The enqueue call, idle button label/icon
  ("Generate quiz" / "Generate cram"), in-flight fallback text, and success link
  label ("Take quiz" / "Study cram") derive from mode. Both modes link to the
  same `/dashboard/quiz-sets/{quiz_set_id}` route (which branches on the set's
  mode) and poll the same `ai_jobs` shape. The poll/terminal/retry logic is
  unchanged.
- **`RagCramPlayer` (new)** — a client flashcard stepper for `mode='cram'` sets.
  Holds `ratings: Record<cardId, boolean>` (true = "Got it") and the current
  card index. Per card it shows the chrome (NN, difficulty chip, topic,
  `SourceRef` page+excerpt) and a flip card (reuses the `Flashcard` composite:
  flip to reveal the back, then "Got it" / "Still learning"). Rating records one
  `recordRagAttempt({questionId: cardId, quizSetId, selectedOptionId: null,
  isCorrect})` (fire-and-forget, best-effort — US-RAG-008b) and advances. A final
  summary shows "knew X of N" with a retake.

## Application Flow

1. Documents panel renders, for each `ready` document, a regular **and** a cram
   `GenerateQuizControl` (the cram one with `mode="cram"`).
2. Clicking "Generate cram" → `enqueueQuizGeneration({documentId, mode:"cram"})`
   → inserts a `generate_cram` `ai_jobs` row → the control polls it.
3. The worker (US-RAG-009) produces a `quiz_set` (mode `cram`) + flashcard
   `questions`; the job's `output.quiz_set_id` flows to the control's success
   link.
4. The player route loads the set + questions; for `mode='cram'` it maps each
   `question` to a card (`front=prompt`, `back=correct_answer`, citation) and
   renders `RagCramPlayer`. Regular sets render the existing `RagQuizPlayer`.
5. Studying a card records a `rag_question_attempts` row keyed by the
   flashcard's `question_id` and the `quiz_set_id`.

## Data Model

No schema change. Reuses:

- `ai_jobs` — a new `generate_cram` row per cram request (`credit_cost=0` set by
  the backend).
- `quiz_sets` (mode `cram`) + `questions` (`type='flashcard'`,
  `correct_answer`=back) — read by the player route (RLS-scoped, owner only).
- `rag_question_attempts` — one row per studied card, `selected_option_id=null`,
  `is_correct` = the self-rating (US-RAG-008b table + RLS policy).

## UI / Platform Impact

`apps/web` only. No new dependency. Reuses the design tokens, `Flashcard`,
`SourceRef`, `DifficultyChip` composites, and the enqueue+poll control. The
player route branches by `quiz_sets.mode`; mock-mode rendering stays out of
scope (a later slice).

## Observability

The trigger surfaces the live job `current_step`/`progress` while generating and
the `error_message` on failure (with retry), identical to the regular trigger.
Attempt writes are best-effort and never block studying (US-RAG-008b: a failed
write logs a readable warning, not a raw object).

## Alternatives Considered

1. **A separate `enqueue-cram-generation.ts` + `GenerateCramControl`.** Rejected:
   the two paths differ only in job_type, input key, and labels. A `mode`
   parameter on the existing action/control reuses the auth, ownership check, and
   poll/terminal/retry logic without a parallel copy.
2. **A scrolling list of flip cards (like the MCQ player).** Rejected: a
   one-at-a-time stepper is the classic cram interaction — flip, self-rate,
   next — and keeps focus on a single card; the MCQ list fits selection, not
   recall.
3. **A dedicated flashcard attempts table / self-rating scale.** Rejected:
   `rag_question_attempts` already models a per-question attempt; a binary
   "Got it / Still learning" maps cleanly to `is_correct` with a null option.
   A richer scale is a later spaced-repetition concern.
