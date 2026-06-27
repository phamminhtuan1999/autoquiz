# Validation

## Proof Strategy

The handler orchestration (attempt + chunk loading, weak-topic citation
validation/mapping, drop rules, the empty-vs-dangling distinction, persistence
calls) sits behind `AttemptSource` / `ChunkSource` / `ReviewGenerator` /
`ReviewStore` seams, so it is proven deterministically with fakes. The real path
— live Gemini generation + real Supabase attempts/chunks read and
quiz_set/study_review writes — is proven by one E2E against live
infrastructure, with teardown.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `study_review_schema` bounds each weak topic's `source_chunk` to the chunk count and requires `summary`/`weak_topics`/`recommended_actions`; `build_review_prompt` shows the attempt roster (✓/✗ + correct answer), the aggregate count, and numbered evidence chunks with pages. Handler: happy path persists a `quiz_set` (mode `study_review`, job_id) + a `study_reviews` row mapping each weak topic to the right `chunk_id`/page/excerpt, with summary stats (attempts/correct/incorrect); drops a weak topic whose citation is out of range; drops a blank-topic item; model weak topics that are **all** dangling → raises and persists nothing; an **empty** model `weak_topics` persists a positive review (no raise); no attempts → raises before generating; no chunks → raises before generating; missing `document_id` → raises; `source_quiz_set_id` is forwarded to the attempt source and recorded in the summary; progress reported in order. |
| Integration | `SupabaseAttemptSource.fetch_attempts` joins `rag_question_attempts` → `questions` (topic/prompt/correct_answer/is_correct), optionally narrowed by `source_quiz_set_id`; `SupabaseQuizStore.save_study_review` inserts one `study_reviews` row (jsonb summary/weak_topics/recommended_actions) and `create_quiz_set` writes `mode='study_review'`. (Exercised through the E2E.) |
| E2E | Live Supabase + live Gemini: seed a ready document + chunks + a regular `quiz_set` with questions and a few `rag_question_attempts` (some incorrect), create a real `generate_study_review` job row, run the handler → a `quiz_set` (mode `study_review`, `job_id` match) and a `study_reviews` row whose `weak_topics` each carry a `source.chunk_id` in the provided set + a non-empty excerpt, a `summary` with attempt stats, and ≥1 `recommended_actions`. Teardown (cascade). |
| Platform | `apps/ai` unit suite passes; modules import without provider keys; handler registered in `DEFAULT_HANDLERS`. |
| Logs/Audit | Job output `{quiz_set_id, study_review_id, weak_topics, attempts_reviewed, provider, model, repaired, fell_back}`. |

## Fixtures

- `FakeAttemptSource`, `FakeChunkSource`, `FakeReviewGenerator` (returns a
  `GenerationResult` or raises), `RecordingReviewStore`, `RecordingProgress`.
- Live Gemini key (`AUTOQUIZ_AI_GEMINI_API_KEY`) + live Supabase service role.
- A borrowed `profiles` id as the owner; a seeded document + chunks + a regular
  quiz_set + questions + attempts.

## Commands

```text
cd apps/ai && PYTHONPATH=. python3 -m unittest discover -s tests
# E2E: real Gemini generation + real Supabase persistence on a seeded document
```

## Acceptance Evidence

Verified 2026-06-26.

- **Unit**: `python3 -m unittest discover -s tests` → **69 tests pass** (57 prior
  + **12 generate_study_review**). Covers `study_review_schema` (bounds each weak
  topic's `source_chunk` to the chunk count; requires summary/weak_topics/
  recommended_actions; no `minItems` floor on weak_topics) and `build_review_prompt`
  (✓/✗ roster + aggregate + numbered evidence chunks), plus the handler matrix:
  citation mapping to chunk id/page/excerpt with summary stats; out-of-range
  citation drop; blank-topic drop; **all-dangling weak topics raise (nothing
  persisted)**; **empty weak_topics persists a positive review (no raise)**; no
  attempts → raise before generating; no chunks → raise before generating;
  missing `document_id` → raise; `source_quiz_set_id` forwarded to the attempt
  source and recorded in the summary; ordered progress.
- **E2E (live Supabase + live Gemini)**: seeded a ready document + 3 chunks, a
  regular source `quiz_set` with 3 questions, and 3 `rag_question_attempts` (2
  incorrect: Mitochondria/ATP + electron transport; 1 correct: glycolysis), plus
  a real `generate_study_review` job. The handler (Gemini `gemini-2.5-flash`,
  real attempt source + chunk source + review store) produced a `quiz_set`
  mode `study_review`, status `ready`, `job_id` matched, `credit_cost=0`, and a
  `study_reviews` row: `summary` stats `{attempts_reviewed: 3, correct: 1,
  incorrect: 2, source_quiz_set_id}`, **2 weak topics — exactly the two missed
  topics** (Mitochondria & ATP, Electron Transport Chain; glycolysis correctly
  excluded), **both citing a provided chunk** (right id + page) with non-empty
  excerpts, and **3 grounded `recommended_actions`**. Output
  `{result: ready, weak_topics: 2, attempts_reviewed: 3, provider: gemini,
  model: gemini-2.5-flash, repaired: true}` — the live one-shot repair recovered
  a first response that failed validation. Fixture torn down (cascade).
- **Platform**: 69-test suite green; `generate_study_review` registered in
  `DEFAULT_HANDLERS`; `generate_study_review.py` / `SupabaseAttemptSource` /
  `SupabaseQuizStore.save_study_review` import without provider keys.
- **Deferred (agreed)**: OpenAI primary generation — covered by US-RAG-007
  fake-provider tests. Study-review web UI → later web slice.
