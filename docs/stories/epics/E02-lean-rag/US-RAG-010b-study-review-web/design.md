# Design

## Component / Action Model

- **`enqueueQuizGeneration` (generalized)** — gains `mode="study_review"` →
  `job_type='generate_study_review'`, input `{document_id}`. Auth + ready-document
  ownership checks are unchanged. **One extra gate for this mode only**: before
  queueing, it counts the document's `rag_question_attempts` (joined via
  `questions!inner(document_id)`); zero → `{ error: "Take a quiz on this document
  first — a study review needs your attempts." }`, so the backend never gets a
  job it would fail with "no attempts to review".
- **`GenerateQuizControl` (generalized)** — gains a `study_review` `COPY` entry
  (idle "Generate review", in-flight "Building review…", success "View review",
  `ClipboardList` icon). The enqueue/poll/terminal/retry logic is unchanged; both
  it and the success link to `/dashboard/quiz-sets/{quiz_set_id}` are shared.
- **`RagStudyReview` (new)** — a server-rendered report (no client state). Given
  the review's `summary`, `weak_topics`, and `recommended_actions`, it renders:
  a summary card (the text + an attempts / correct / incorrect readout and an
  accuracy bar); a weak-topics list (each card: topic, why, recommended action,
  and a `SourceRef` page+excerpt) or a positive empty state when there are none;
  and a recommended-actions checklist.

## Application Flow

1. The documents panel renders, for each `ready` document, a `study_review`
   `GenerateQuizControl` beside the regular / cram / mock triggers.
2. "Generate review" → `enqueueQuizGeneration({documentId, mode:"study_review"})`.
   With no attempts, the action returns the friendly error inline. With attempts,
   it inserts a `generate_study_review` `ai_jobs` row and the control polls it.
3. The worker (US-RAG-010) produces a `quiz_set` (mode `study_review`) + a
   `study_reviews` row; the job's `output.quiz_set_id` flows to the success link.
4. The player route loads the set; for `mode='study_review'` it fetches the
   set's latest `study_reviews` row and renders `RagStudyReview`. The other modes
   render their players unchanged.

## Data Model

No schema change. Reuses:

- `ai_jobs` — a `generate_study_review` row per request (`credit_cost=0`).
- `quiz_sets` (mode `study_review`) — the review container (RLS-scoped, owner
  only).
- `study_reviews` — `summary` (`{text, attempts_reviewed, correct, incorrect}`),
  `weak_topics` (`[{topic, why, recommended_action, source:{page_start, page_end,
  excerpt, …}}]`), `recommended_actions` (`[string]`) — read by the route.
- `rag_question_attempts` — counted (joined to `questions`) by the enqueue gate.

## UI / Platform Impact

`apps/web` only. No new dependency. Reuses the design tokens, `SourceRef`, and the
enqueue+poll control. The player route branches by `quiz_sets.mode`; the review
branch is handled before the question-count empty state (a review set has no
`questions`).

## Observability

The trigger surfaces the live job `current_step`/`progress` while building and the
`error_message` on failure (with retry), identical to the other triggers. The
attempts pre-check turns the common "nothing to review yet" case into an inline,
non-failing message instead of a failed job.

## Alternatives Considered

1. **Place the trigger on a finished quiz's results instead of the document.**
   Rejected for this slice: the per-document trigger reuses the existing control
   and reviews all of a document's attempts; an after-quiz, set-scoped review
   (`source_quiz_set_id`) is a natural later refinement.
2. **Render the review inside a player component.** Rejected: a review is a
   read-only report, not an interactive attempt; a dedicated `RagStudyReview`
   keeps the player components focused.
3. **Queue the job and let it fail when there are no attempts.** Rejected: a
   3×-retried failed job is poor UX for the expected "you haven't practiced yet"
   case; a cheap pre-check returns a friendly message and never queues.
