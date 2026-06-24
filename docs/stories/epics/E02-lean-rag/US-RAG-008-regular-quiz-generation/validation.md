# Validation

## Proof Strategy

The handler orchestration (chunk loading, citation validation/mapping, drop
rules, persistence calls) sits behind `ChunkSource` / `QuizGenerator` /
`QuizStore` seams, so it is proven deterministically with fakes. The real path —
live Gemini generation + real Supabase chunk read and quiz/question/option
writes — is proven by one E2E against live infrastructure, with teardown.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `quiz_schema` bounds `source_chunk` to chunk count and array to num_questions; `build_prompt` numbers chunks + shows pages + difficulty. Handler: happy path persists a `quiz_set` (mode `regular`, job_id) + maps each citation to the right `chunk_id`/page/excerpt/correct answer; drops a question whose citation is out of range; drops a malformed question (≠4 options, bad answer_index); zero valid citations → raises and persists nothing; no chunks → raises before calling the model; missing `document_id` → raises; `num_questions` clamped to 20; progress reported in order. |
| Integration | `SupabaseQuizStore` inserts questions then zips the returned ids to 4 answer options each with one `is_correct`; `SupabaseChunkSource` orders by `chunk_index`. (Exercised through the E2E.) |
| E2E | Live Supabase + live Gemini: seed a ready document + 3 chunks, create a real `generate_regular_quiz` job row, run the handler → a `quiz_set` (mode `regular`, `job_id` match) with ≥1 `questions`, each with 4 `answer_options`, exactly one correct, a `source_chunk_id` in the provided set, and a non-empty `source_excerpt`. Teardown. |
| Platform | `apps/ai` unit suite passes; modules import without provider keys; handler registered in `DEFAULT_HANDLERS`. |
| Logs/Audit | Job output `{quiz_set_id, questions, provider, model, repaired, fell_back}`. |

## Fixtures

- `FakeChunkSource`, `FakeGenerator` (returns a `GenerationResult` or raises),
  `RecordingQuizStore`, `RecordingProgress`.
- Live Gemini key (`AUTOQUIZ_AI_GEMINI_API_KEY`) + live Supabase service role.
- A borrowed `profiles` id as the owner; a seeded document + 3 biology chunks.

## Commands

```text
cd apps/ai && PYTHONPATH=. python3 -m unittest discover -s tests
# E2E: real Gemini generation + real Supabase persistence on a seeded document
```

## Acceptance Evidence

Verified 2026-06-24.

- **Unit**: `python3 -m unittest discover -s tests` → **47 tests pass** (37 prior
  + **10 generate_quiz**). Covers schema/prompt construction and the handler
  matrix above: citation mapping to chunk id/page/excerpt/correct answer,
  out-of-range and malformed drops, no-valid-citation raise (nothing persisted),
  no-chunks raise before generating, missing-input raise, num_questions clamp,
  ordered progress.
- **E2E (live Supabase + live Gemini)**: seeded a ready document + 3 chunks and a
  real `generate_regular_quiz` job; the handler (Gemini `gemini-2.5-flash`,
  real chunk source + quiz store) produced `quiz_set` mode `regular`, status
  `ready`, `job_id` matched, **3 questions** each with **4 answer_options /
  exactly one correct**, **all citations resolved to the provided chunks**, and
  non-empty `source_excerpt`s. Output
  `{result: ready, questions: 3, provider: gemini, repaired: true}` — the live
  one-shot repair recovered a first response that failed validation. Fixture
  torn down (cascade).
- **E2E harness note**: orphan `generate_regular_quiz` jobs from aborted runs
  were claimed out of order by `JobRunner.run_once()`; the E2E was made
  deterministic by calling the handler directly with a real job row (claim/
  complete is proven in US-RAG-003) and pre-cleaning stale jobs.
- **Deferred (agreed)**: OpenAI primary generation — covered by US-RAG-007
  fake-provider tests; documented manual run once a key is set. Web quiz-taking
  migration → US-RAG-008b.
