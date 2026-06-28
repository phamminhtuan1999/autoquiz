# Design

## Domain Model

- **SourceChunk** (reused from US-RAG-008) — `chunk_id`, `chunk_index`,
  `content`, `page_start/end`. The grounding context unit; its 1-based position
  is the citation key the model returns.
- **GeneratedQuestion** (reused from US-RAG-008) — a persistable MCQ: `prompt`,
  `options` (4), `answer_index`, `correct_answer`, `explanation`, resolved
  citation, `topic`, `difficulty`.
- **GeneratedEssay** (new) — a persistable essay: `prompt`, `sample_answer`
  (persisted as `correct_answer`), `explanation`, resolved citation, `topic`,
  and `metadata` carrying `{rubric, max_points, suggested_minutes}` (decision
  0012). No options.
- **GenerateMockExamHandler** — orchestrates load → generate → validate
  citations → persist; holds a `ChunkSource`, `MockGenerator`, `MockStore`, and
  `ProgressReporter`.

## Application Flow

`GenerateMockExamHandler.__call__(job)`:

1. Parse `document_id` (required), `num_mcq` (default 10, clamped 1–30),
   `num_essay` (default 2, clamped 0–5), `difficulty` (optional),
   `time_limit_minutes` (optional; default derived from counts) from `job.input`.
2. `ChunkSource.fetch_chunks(document_id, user_id, limit)` → ordered chunks.
   Empty ⇒ `ValueError` (an un-indexed document should not have been queued).
3. Build the prompt (numbered chunks + MCQ/essay rules) and the per-request
   schema (`mock_schema(chunk_count, num_mcq, num_essay)` bounds each question's
   `source_chunk` to `[1, chunk_count]` and the arrays to their counts).
4. `MockGenerator.generate(prompt, schema, system)` (US-RAG-007 service:
   validate + one repair + provider fallback).
5. Map MCQs (drop out-of-range citation or `options != 4`) → `GeneratedQuestion`;
   map essays (drop out-of-range citation or blank prompt) → `GeneratedEssay`
   with the rubric in `metadata`. **Zero total survivors ⇒ `ValueError`** (an
   exam needs at least one cited question; nothing persisted).
6. `MockStore.create_quiz_set(mode='mock', ...)` → `quiz_set_id`;
   `MockStore.save_questions(mcqs)` (reused US-RAG-008 path, `type='mcq'` +
   `answer_options`) and `MockStore.save_essays(essays)` (`type='essay'`, rubric
   metadata, no options).
7. Return `JobResult({result: ready, quiz_set_id, mcq, essays,
   time_limit_minutes, provider, model, repaired, fell_back})`.

Progress is reported at load (5) → generate (35) → validate (70) → save (90),
best-effort (never fails the job) — same cadence as US-RAG-008/009/010.

## Interface Contract

- Job input: `{document_id, num_mcq?, num_essay?, difficulty?,
  time_limit_minutes?}`.
- Job output: `{result, quiz_set_id, mcq, essays, time_limit_minutes, provider,
  model, repaired, fell_back}`.
- `build_generate_mock_exam_handler(settings)` wires `SupabaseChunkSource`,
  `build_generation_service` (US-RAG-007), `SupabaseQuizStore` (its reused
  `save_questions` + new `save_essays`), and the job repository as progress
  reporter. Registered as `generate_mock_exam` in `DEFAULT_HANDLERS` (replaces
  the stub).

## Data Model

Writes only (no schema change — tables exist from US-RAG-002; decision 0012):

- `quiz_sets` — `mode='mock'`, `status='ready'`, `document_id`, `job_id`,
  `difficulty`, `credit_cost=0`.
- `questions` — MCQ: `type='mcq'`, `prompt`, `correct_answer`, `explanation`,
  citation columns. Essay: `type='essay'`, `prompt`, `correct_answer` (sample
  answer), citation columns, and `metadata={rubric, max_points,
  suggested_minutes}`.
- `answer_options` — MCQ only (A–D, one `is_correct`). Essays have none.

Reads: `document_chunks` for grounding. Service role bypasses RLS, so every row
carries the document owner's `user_id`. `questions` cascade-delete with the
`quiz_set`.

`SupabaseQuizStore` gains a `save_essays(...)` method beside `save_questions` /
`save_cards` / `save_study_review`; `create_quiz_set` is reused unchanged.

## UI / Platform Impact

`apps/ai` only. No web change in this slice (the mock session/grading UI is a
later web slice). No new dependency. New module `app/jobs/generate_mock_exam.py`
mirrors `generate_quiz.py`; it reuses `SourceChunk` / `ChunkSource` /
`GeneratedQuestion` and the generation service protocol shape.

## Observability

Job output records the serving `provider`/`model`, whether a `repaired` or
`fell_back` path was taken, and the exam shape (`mcq`, `essays`,
`time_limit_minutes`). `quiz_set_id` makes the generation auditable; dropped
questions (failed citation) are simply absent.

## Alternatives Considered

1. **Rubric in a dedicated table.** Rejected for this slice — see decision 0012
   (additive `metadata` path; a later session story can normalize if needed).
2. **One unified question array (mix MCQ + essay in a single list).** Rejected:
   distinct arrays let the schema bound counts independently and keep the MCQ
   mapping identical to US-RAG-008 (reuse `GeneratedQuestion` + `save_questions`).
3. **Multi-document exams (as the legacy action).** Rejected: the RAG path is
   per-document and grounded; multi-document mock is out of scope for the MVP
   cutover.
4. **Persist `time_limit_minutes` on `quiz_sets`.** Rejected: `quiz_sets` has no
   duration column and this slice adds no schema; the suggested limit is echoed
   in the job output and per-essay `suggested_minutes` lives in metadata (decision
   0012). Durable exam-level state is a later mock-session concern.
