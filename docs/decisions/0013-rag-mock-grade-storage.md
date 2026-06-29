# 0013 RAG mock-exam grades live in the grading job's output

Date: 2026-06-28

## Status

Accepted

## Context

US-RAG-012b adds rubric-backed essay grading to the web mock session. The
backend already stores each essay's grading rubric in `questions.metadata`
(decision 0012) and the student's essay answer fits the existing
`rag_question_attempts.answer_text` column. What had no home was the **graded
result** — a per-essay rubric score plus written feedback and an exam total.

The RAG data model (`docs/product/rag-data-model.md`) has no grade store:
`rag_question_attempts` records an attempt (`selected_option_id`, `answer_text`,
`is_correct`, `time_spent_ms`) but carries no score or feedback, and there is no
grade table. Grading is also an LLM operation that, per the clean-cutover
architecture, must run in the SDK-free `apps/ai` worker (not a server-side
direct-provider call), which means it runs as an `ai_jobs` job — and
`ai_jobs.job_type` is constrained by a CHECK to the existing job types.

So two coupled questions had to be answered before implementation: where the
grade is persisted, and how the grading job type is admitted.

## Decision

- **Grades live in the `grade_mock_exam` job's `ai_jobs.output`** (jsonb, already
  durable), keyed by `quiz_set_id` in the job input. The worker writes
  `{result:"graded", quiz_set_id, total_score, max_total, essays:[{question_id,
  prompt, score, max_points, criteria:[{name, score, max_points, comment}],
  feedback, answered}], provider, model, repaired, fell_back}`. The web player
  polls that job (the same enqueue+poll pattern as generation) and renders it.
- **No new columns on `rag_question_attempts` and no grade table** this slice.
  The essay *answer* stays in `rag_question_attempts.answer_text`; the *grade* is
  a job artifact, consistent with how every other RAG job returns its result.
- **One additive schema change**: extend the `ai_jobs.job_type` CHECK constraint
  to include `'grade_mock_exam'`, via an idempotent `do $$ … alter table …
  drop/add constraint … $$` block in `supabase/schema.sql`, applied to the live
  DB. Additive only — no row migration, no backfill, no deletion.

## Alternatives Considered

1. **New `score`/`max_score`/`feedback jsonb`/`graded_at` columns on
   `rag_question_attempts`** — per-attempt grade history, but a larger additive
   migration and more RLS/contract surface than the slice needs; deferred until
   grade history is an actual requirement.
2. **A dedicated `mock_grades` (or `essay_grades`) table** — cleanest for rich
   history and re-grading, but premature: it adds a table, RLS policies, and a
   read contract for a single graded-result-per-set need that `ai_jobs.output`
   already satisfies.
3. **Grade synchronously in a Next.js server action calling the LLM** — avoids a
   job entirely, but reintroduces the server-side direct-provider path the clean
   cutover removes, and bypasses the provider/repair/fallback service.

## Consequences

Positive:

- No table or column migration; mirrors decision 0012's "reuse, don't add tables"
  stance and the existing `ai_jobs.output` result convention.
- Grading reuses the worker's provider/repair/fallback service and the web's
  enqueue+poll control with no new infrastructure.
- The grade is durable and owner-scoped (the job row is the student's, RLS-read
  via the session client).

Tradeoffs:

- No first-class grade history: the player surfaces the most recent
  `grade_mock_exam` job for a set; older gradings live only as prior job rows.
- Reading a grade means resolving the grading job (by id from the submit flow),
  not a direct `quiz_set → grade` foreign key. Acceptable for one-graded-result
  per session.
- The additive CHECK change must be applied to every environment's DB, like the
  earlier job-type additions.

## Follow-Up

- If grade history / re-grading or teacher review becomes a requirement, promote
  the grade to a `mock_grades` table (or attempt columns) and backfill from job
  outputs — a later, explicitly-scoped migration.
- Fold into the clean cutover that retires the legacy `mock_exams` grade columns.
