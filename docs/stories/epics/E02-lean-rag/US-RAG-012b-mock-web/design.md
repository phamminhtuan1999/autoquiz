# Design

## Domain Model

- **Mock `quiz_set` (mode `mock`)** — produced by US-RAG-012. Holds two kinds of
  `questions`: `type='mcq'` (with `answer_options`, `correct_answer`) and
  `type='essay'` (`metadata.rubric` / `metadata.max_points` /
  `metadata.suggested_minutes`, `correct_answer` = sample answer). Read-only here.
- **Mock attempt** — the student's answers, written to `rag_question_attempts`:
  one row per MCQ (`selected_option_id`, `is_correct` from the option) and one
  per answered essay (`answer_text`, `selected_option_id=null`, `is_correct=null`).
- **Essay grade** — a derived, per-essay rubric score + written feedback,
  produced by the `grade_mock_exam` job. It is **not** persisted as a row; it
  lives in that job's `ai_jobs.output` (decision 0013), keyed by `quiz_set_id`.

## Application Flow

1. The documents panel renders, for each `ready` document, a `mode="mock"`
   `GenerateQuizControl` alongside the regular and cram triggers.
2. "Generate mock exam" → `enqueueQuizGeneration({documentId, mode:"mock"})`
   inserts a `generate_mock_exam` `ai_jobs` row; the control polls it; on success
   it links to `/dashboard/quiz-sets/{quiz_set_id}`.
3. The player route loads the set + questions; for `mode='mock'` it splits rows
   into MCQ questions (with options) and essay questions (prompt + max-points +
   suggested-minutes + citation) and renders `RagMockPlayer`.
4. `RagMockPlayer` runs a client countdown (sum of MCQ allowance + essay
   suggested-minutes, the same formula as the backend default). The student
   selects MCQ answers and writes essay responses. **Submit** (manual, or auto on
   timeout):
   - records each MCQ as a `rag_question_attempts` row (`is_correct` from the
     chosen option) and computes the MCQ score client-side;
   - records each non-empty essay answer as a `rag_question_attempts` row
     (`answer_text`), then
   - calls `enqueueMockGrading({quizSetId})` to queue the `grade_mock_exam` job
     and polls it.
5. `grade_mock_exam` (worker): loads the set's essay questions + each one's latest
   `answer_text`, grades every **answered** essay against its rubric via the
   US-RAG-007 service (one structured call per essay; blank answers score 0 with
   no model call), and returns `{result:"graded", total_score, max_total, essays:
   [{question_id, score, max_points, criteria[], feedback}], …}` — persisted to
   `ai_jobs.output` by the runner.
6. The player renders the MCQ score immediately and the essay grades once the
   grading job reaches `succeeded`.

## Interface Contract

- **`enqueueQuizGeneration(input)`** gains `mode="mock"` →
  `job_type='generate_mock_exam'`, input `{document_id, num_mcq, num_essay,
  difficulty}` (counts clamped: MCQ 1–30, essay 0–5). Backward compatible.
- **`enqueueMockGrading({quizSetId})`** (new server action) — verifies the caller
  owns the `mock` quiz_set, inserts an `ai_jobs` row `job_type='grade_mock_exam'`,
  input `{quiz_set_id}`; returns `{jobId}` or `{error}`.
- **`recordRagAttempt(input)`** gains optional `answerText` and accepts
  `isCorrect: boolean | null` so an essay answer can be recorded
  (`answer_text` set, `is_correct=null`). MCQ behavior unchanged.
- **`grade_mock_exam` job** — input `{quiz_set_id}` (required); output as above.
  `job_type` added to the `ai_jobs` CHECK constraint (data-model change).

## Data Model

One **additive** schema change: extend the `ai_jobs.job_type` CHECK constraint to
include `'grade_mock_exam'` (drop + recreate the named constraint inside an
idempotent `do $$ … $$` block in `supabase/schema.sql`, applied to the live DB).
No new tables, no new columns, no backfill, no deletion. Everything else reuses
tables shipped in US-RAG-002 and written by US-RAG-008b/012:

- `ai_jobs` — a `generate_mock_exam` row per generation and a `grade_mock_exam`
  row per submission; the latter's `output` holds the durable grade
  (`credit_cost` N/A — credits are US-RAG-011).
- `quiz_sets` (mode `mock`) + `questions` (`type='mcq'`/`'essay'`) +
  `answer_options` — read by the player route (RLS-scoped, owner only).
- `rag_question_attempts` — one row per answered MCQ (`selected_option_id`,
  `is_correct`) and per answered essay (`answer_text`); `is_correct` is already
  nullable, `answer_text` already exists (US-RAG-008b table + RLS policy).

The grade is read back from `ai_jobs.output` (the worker writes it with the
service role; the player reads its own job via the session client + RLS).

## UI / Platform Impact

`apps/web` (player route, generalized enqueue/control, mock player, grade action)
and `apps/ai` (the `grade_mock_exam` handler + IO + registration). No new web
dependency. Reuses the design tokens, `SourceRef`, `DifficultyChip`, and the
enqueue+poll control. The player route branches by `quiz_sets.mode`; the route's
question select adds `type` + `metadata` so essays carry their rubric metadata.

## Observability

The generate and grade triggers surface the live job `current_step`/`progress`
while running and the `error_message` on failure (with retry), identical to the
regular trigger. MCQ attempt + essay-answer writes are best-effort and never
block submitting (US-RAG-008b: a failed write logs a readable warning). The grade
job records `provider`/`model`/`repaired`/`fell_back` in its output, consistent
with the generation jobs.

## Alternatives Considered

1. **Persist essay grades in new `rag_question_attempts` columns
   (`score`/`max_score`/`feedback`/`graded_at`) or a dedicated grade table.**
   Rejected for this slice: a larger additive migration plus more RLS/contract
   surface than needed. The grade is naturally a job artifact; `ai_jobs.output`
   is already durable jsonb and is how every other RAG job returns its result
   (decision 0013). A per-attempt grade table is a later concern if grade history
   becomes a requirement.
2. **Grade synchronously in a Next.js server action calling the LLM directly.**
   Rejected: it reintroduces the direct-provider, server-side-key path the clean
   cutover is moving away from. Grading belongs in the SDK-free worker alongside
   generation, behind the same provider/repair/fallback service.
3. **One structured call grading all essays at once.** Rejected: the nested
   rubric-criteria schema is already the deepest the model handles (US-RAG-012
   saw first-attempt validation failures auto-repaired); batching N essays
   compounds that. One flat call per essay isolates failures and keeps each
   schema shallow. Typical essay count is 2.
4. **A separate `enqueue-mock-generation.ts` + `GenerateMockControl`.** Rejected:
   consistent with 009b, a `mode` parameter on the existing action/control reuses
   the auth, ownership check, and poll/terminal/retry logic without a parallel
   copy.
5. **A scrolling single-page mock like the MCQ player.** Kept the single-page
   scroll for the exam body (all questions visible, answer in any order — exam
   ergonomics) but added a sticky timer + a submit gate, which the instant-reveal
   quiz player deliberately lacks.
