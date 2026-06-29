# Overview

## Current Behavior

US-RAG-012 ships the backend `generate_mock_exam` handler: a ready document
becomes a normalized, source-cited mock `quiz_set` (mode `mock`) holding MCQ
`questions` (`type='mcq'` + `answer_options`) and essay `questions`
(`type='essay'`, grading rubric / max-points / suggested-minutes in `metadata`
per decision 0012, `correct_answer` = the reference sample answer).

US-RAG-008b/009b ship the web path for **regular** and **cram** sets — a
per-document generate trigger, an `ai_jobs` enqueue + poll, a cited player, and
attempt recording. But **mock has no web surface**: nothing enqueues a
`generate_mock_exam` job, the player route only renders MCQ and flashcard sets,
and there is **no essay grading** — the rubrics the backend produces are never
applied to a student's answer. The live app still produces a mock via the legacy
direct-Gemini path into the `mock_exams` table, ungrounded.

## Target Behavior

Wire the shipped mock backend into the UI and close the loop with rubric-backed
essay grading, reusing the US-RAG-008b enqueue+poll pattern:

- A per-ready-document **"Generate mock exam"** trigger that enqueues a
  `generate_mock_exam` `ai_jobs` row, polls it, then links to the mock player.
- The quiz-set player route renders a **timed mock session** for `mode='mock'`
  sets: a countdown derived from the questions' suggested minutes, exam-style
  MCQ (select, no instant reveal) and essay textareas, each citing its source,
  and a single submit. On submit, MCQ answers are auto-graded from their options
  and recorded; essay answers are captured to `rag_question_attempts.answer_text`.
- **Rubric-backed essay grading**: submitting enqueues a new `grade_mock_exam`
  `ai_jobs` row; the worker grades each essay answer against its stored rubric
  via the US-RAG-007 LLM/repair/fallback service and writes the per-essay scores
  + feedback + totals to the job's `output`. The player polls it and renders the
  MCQ score plus the rubric-scored essay feedback.

Regular MCQ and cram sets keep rendering their existing players unchanged.

## Affected Users

- Student (document owner) — an indexed document can be turned into a grounded,
  timed mock exam taken in-app, with the MCQ section auto-scored and each essay
  graded against a source-cited rubric with written feedback.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow 7–8, `mock` generation mode:
  "Timed MCQ/essay exam … with citations and rubric-backed grading")
- `docs/product/rag-data-model.md` (`quiz_sets` mode `mock`, `questions`
  `type='mcq'`/`'essay'`, `rag_question_attempts`, `ai_jobs.job_type`)
- `docs/product/rag-clean-cutover.md` (mock result page backed by `quiz_sets`,
  retiring the legacy `mock_exams` flow)

## Non-Goals

- Retiring the legacy `mock_exams` / direct-Gemini mock flow — a later cutover
  step once this path is released.
- A new attempts/grade schema — essay answers reuse `rag_question_attempts`
  (`answer_text`), and grades live in the `grade_mock_exam` job's `ai_jobs.output`
  (decision 0013). No per-attempt grade columns or grade table this slice.
- Credit spend/refund on generation or grading (US-RAG-011) — the jobs record
  `credit_cost=0`.
- Resuming an in-progress timed session across reloads / server-enforced time
  limits — the timer is a client-side study aid this slice.
- Re-grading history / multiple graded attempts per set — the player surfaces
  the most recent grading job.
