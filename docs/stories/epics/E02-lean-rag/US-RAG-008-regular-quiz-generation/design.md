# Design

## Domain Model

- **SourceChunk** — `chunk_id`, `chunk_index`, `content`, `page_start/end`. The
  grounding context unit; its 1-based position in the provided list is the
  citation key the model returns.
- **GeneratedQuestion** — a persistable MCQ: `prompt`, `options[4]`,
  `answer_index`, `correct_answer`, `explanation`, resolved citation
  (`source_chunk_id`, `source_page_start/end`, `source_excerpt`), `topic`,
  `difficulty`.
- **GenerateRegularQuizHandler** — orchestrates load → generate → validate
  citations → persist; holds a `ChunkSource`, `QuizGenerator`, `QuizStore`, and
  `ProgressReporter`.

## Application Flow

`GenerateRegularQuizHandler.__call__(job)`:

1. Parse `document_id` (required), `num_questions` (default 5, clamped 1–20),
   `difficulty` (optional) from `job.input`.
2. `ChunkSource.fetch_chunks(document_id, user_id, limit)` → ordered chunks.
   Empty ⇒ `ValueError` (an un-indexed document should not have been queued).
3. Build the prompt (numbered chunks + rules) and the per-request schema
   (`quiz_schema(chunk_count, num_questions)` bounds `source_chunk` to
   `[1, chunk_count]` and the array to `num_questions`).
4. `QuizGenerator.generate(prompt, schema, system)` (US-RAG-007 service: validate
   + one repair + provider fallback).
5. Map questions: drop any whose `source_chunk` is out of range or whose
   options/answer are malformed; resolve the rest to `GeneratedQuestion` with the
   cited chunk's id/page/excerpt. Zero survivors ⇒ `ValueError` (nothing
   persisted).
6. `QuizStore.create_quiz_set(...)` → `quiz_set_id`; `QuizStore.save_questions(...)`.
7. Return `JobResult({result: ready, quiz_set_id, questions, provider, model,
   repaired, fell_back})`.

Progress is reported at load (5) → generate (30) → validate (70) → save (90),
best-effort (never fails the job).

## Interface Contract

- Job input: `{document_id, num_questions?, difficulty?}`.
- Job output: `{result, quiz_set_id, questions, provider, model, repaired,
  fell_back}`.
- `build_generate_regular_quiz_handler(settings)` wires `SupabaseChunkSource`,
  `build_generation_service` (US-RAG-007), `SupabaseQuizStore`, and the job
  repository as progress reporter. Registered as `generate_regular_quiz` in
  `DEFAULT_HANDLERS`.

## Data Model

Writes only (no schema change — tables exist from US-RAG-002):

- `quiz_sets` — `mode='regular'`, `status='ready'`, `document_id`, `job_id`,
  `difficulty`, `credit_cost=0`.
- `questions` — `type='mcq'`, `prompt`, `correct_answer`, `explanation`,
  `source_chunk_id`, `source_page_start/end`, `source_excerpt`.
- `answer_options` — 4 rows per question, `label` A–D, `is_correct` on the
  answer index.

Service role bypasses RLS, so every row carries the document owner's `user_id`.
`questions`/`answer_options` cascade-delete with the `quiz_set`.

## UI / Platform Impact

`apps/ai` only. No web change in this slice (quiz-taking UI is US-RAG-008b). No
new dependency. New IO classes `SupabaseChunkSource` / `SupabaseQuizStore` reuse
the existing `urllib` PostgREST pattern; `_post_returning` adds
`return=representation` so inserted ids map back to answer options in order.

## Observability

Job output records the serving `provider`/`model` and whether a `repaired` or
`fell_back` path was taken. Question count and `quiz_set_id` make the generation
auditable; dropped questions (failed citation) are simply absent.

## Alternatives Considered

1. **Run the full claim→complete protocol in the handler.** Rejected: the
   handler returns a `JobResult` and the `JobRunner` owns claim/complete/fail
   (US-RAG-003). Keeping the handler pure makes it unit-testable and reusable.
2. **Ground via the same-space query `Retriever` (US-RAG-006).** Rejected for a
   *whole-document* regular quiz: a single query under-samples the document.
   Direct chunk grounding gives broad coverage; the query path fits targeted
   modes (study review) later.
3. **Store verbatim excerpts vs derive from `chunk_id` at render.** Chose to
   store a bounded `source_excerpt` on the question (resolves the open decision
   in initiative 0002 for this slice) so the quiz-taking UI can show a citation
   without a second fetch; the `source_chunk_id` is kept for full-passage lookup.
