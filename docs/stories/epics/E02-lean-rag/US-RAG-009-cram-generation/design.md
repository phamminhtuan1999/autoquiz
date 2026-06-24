# Design

## Domain Model

- **SourceChunk** (reused from US-RAG-008) — `chunk_id`, `chunk_index`,
  `content`, `page_start/end`. The grounding context unit; its 1-based position
  in the provided list is the citation key the model returns.
- **GeneratedCard** — a persistable flashcard: `prompt` (front / question),
  `answer` (back, persisted as `correct_answer`), `explanation`, resolved
  citation (`source_chunk_id`, `source_page_start/end`, `source_excerpt`),
  `topic`, `difficulty`. No options — a flashcard is recall, not selection.
- **GenerateCramHandler** — orchestrates load → generate → validate citations →
  persist; holds a `ChunkSource`, `CramGenerator`, `CramStore`, and
  `ProgressReporter`.

## Application Flow

`GenerateCramHandler.__call__(job)`:

1. Parse `document_id` (required), `num_cards` (default 10, clamped 1–30),
   `difficulty` (optional) from `job.input`.
2. `ChunkSource.fetch_chunks(document_id, user_id, limit)` → ordered chunks.
   Empty ⇒ `ValueError` (an un-indexed document should not have been queued).
3. Build the prompt (numbered chunks + rules) and the per-request schema
   (`cram_schema(chunk_count, num_cards)` bounds `source_chunk` to
   `[1, chunk_count]` and the array to `num_cards`).
4. `CramGenerator.generate(prompt, schema, system)` (US-RAG-007 service:
   validate + one repair + provider fallback).
5. Map cards: drop any whose `source_chunk` is out of range or whose
   `prompt`/`answer` is blank; resolve the rest to `GeneratedCard` with the
   cited chunk's id/page/excerpt. Zero survivors ⇒ `ValueError` (nothing
   persisted).
6. `CramStore.create_quiz_set(mode='cram', ...)` → `quiz_set_id`;
   `CramStore.save_cards(...)`.
7. Return `JobResult({result: ready, quiz_set_id, cards, provider, model,
   repaired, fell_back})`.

Progress is reported at load (5) → generate (30) → validate (70) → save (90),
best-effort (never fails the job) — same cadence as US-RAG-008.

## Interface Contract

- Job input: `{document_id, num_cards?, difficulty?}`.
- Job output: `{result, quiz_set_id, cards, provider, model, repaired,
  fell_back}`.
- `build_generate_cram_handler(settings)` wires `SupabaseChunkSource`,
  `build_generation_service` (US-RAG-007), `SupabaseQuizStore` (its `save_cards`
  method), and the job repository as progress reporter. Registered as
  `generate_cram` in `DEFAULT_HANDLERS`.

## Data Model

Writes only (no schema change — tables exist from US-RAG-002):

- `quiz_sets` — `mode='cram'`, `status='ready'`, `document_id`, `job_id`,
  `difficulty`, `credit_cost=0`.
- `questions` — `type='flashcard'`, `prompt` (front), `correct_answer` (back),
  `explanation`, `source_chunk_id`, `source_page_start/end`, `source_excerpt`.
- `answer_options` — **none**. A flashcard is recall; there are no choices.

Service role bypasses RLS, so every row carries the document owner's `user_id`.
`questions` cascade-delete with the `quiz_set`.

`SupabaseQuizStore` gains a `save_cards(...)` method beside `save_questions(...)`
— same `questions` insert path, `type='flashcard'`, and no `answer_options`
follow-up. `create_quiz_set` is reused unchanged (it already takes any `mode`).

## UI / Platform Impact

`apps/ai` only. No web change in this slice (cram review UI is a later web
slice). No new dependency. New module `app/jobs/generate_cram.py` mirrors
`generate_quiz.py`; it reuses `SourceChunk` / `ChunkSource` and the generation
service protocol shape.

## Observability

Job output records the serving `provider`/`model` and whether a `repaired` or
`fell_back` path was taken. Card count and `quiz_set_id` make the generation
auditable; dropped cards (failed citation) are simply absent.

## Alternatives Considered

1. **Reuse `GeneratedQuestion` with empty options.** Rejected: a flashcard has
   no options or `answer_index`; a dedicated `GeneratedCard` keeps the schema,
   prompt, and persistence honest (`type='flashcard'`, no `answer_options`).
2. **A separate `SupabaseCramStore` class.** Rejected for now: the only
   difference from `SupabaseQuizStore` is the question `type` and skipping
   `answer_options`. A `save_cards` method on the existing store reuses
   `create_quiz_set` and the `questions` insert without a parallel class.
3. **MCQ-style cram (4 options).** Rejected: cram is rapid recall review; a
   front/back card matches the product's "golden nuggets / blitz" intent and the
   `questions.type='flashcard'` shape already in the schema. Regular MCQ is
   US-RAG-008.
