# Validation

## Proof Strategy

The handler orchestration (chunk loading, citation validation/mapping, drop
rules, persistence calls) sits behind `ChunkSource` / `CramGenerator` /
`CramStore` seams, so it is proven deterministically with fakes. The real path —
live Gemini generation + real Supabase chunk read and quiz/flashcard writes — is
proven by one E2E against live infrastructure, with teardown.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `cram_schema` bounds `source_chunk` to chunk count and array to num_cards, with flashcard item shape (prompt/answer/source_chunk, no options); `build_cram_prompt` numbers chunks + shows pages + difficulty. Handler: happy path persists a `quiz_set` (mode `cram`, job_id) + maps each citation to the right `chunk_id`/page/excerpt and `correct_answer`=answer; drops a card whose citation is out of range; drops a card with a blank prompt/answer; zero valid citations → raises and persists nothing; no chunks → raises before calling the model; missing `document_id` → raises; `num_cards` clamped to 30; progress reported in order. |
| Integration | `SupabaseQuizStore.save_cards` inserts `questions` with `type='flashcard'` and writes **no** `answer_options`; `create_quiz_set` writes `mode='cram'`. (Exercised through the E2E.) |
| E2E | Live Supabase + live Gemini: seed a ready document + 3 chunks, create a real `generate_cram` job row, run the handler → a `quiz_set` (mode `cram`, `job_id` match) with ≥1 `questions` (`type='flashcard'`), each with a non-empty `correct_answer`, a `source_chunk_id` in the provided set, a non-empty `source_excerpt`, and **zero** `answer_options`. Teardown. |
| Platform | `apps/ai` unit suite passes; modules import without provider keys; handler registered in `DEFAULT_HANDLERS`. |
| Logs/Audit | Job output `{quiz_set_id, cards, provider, model, repaired, fell_back}`. |

## Fixtures

- `FakeChunkSource`, `FakeCramGenerator` (returns a `GenerationResult` or
  raises), `RecordingCramStore`, `RecordingProgress`.
- Live Gemini key (`AUTOQUIZ_AI_GEMINI_API_KEY`) + live Supabase service role.
- A borrowed `profiles` id as the owner; a seeded document + 3 biology chunks.

## Commands

```text
cd apps/ai && PYTHONPATH=. python3 -m unittest discover -s tests
# E2E: real Gemini generation + real Supabase persistence on a seeded document
```

## Acceptance Evidence

Verified 2026-06-24.

- **Unit**: `python3 -m unittest discover -s tests` → **57 tests pass** (47 prior
  + **10 generate_cram**). Covers `cram_schema` (flashcard item shape: prompt +
  answer + source_chunk, no options/answer_index) and `build_cram_prompt`, plus
  the handler matrix: citation mapping to chunk id/page/excerpt and `correct_answer`
  = answer, out-of-range citation drop, blank-front/back drop, no-valid-citation
  raise (nothing persisted), no-chunks raise before generating, missing-input
  raise, `num_cards` clamp to 30, ordered progress.
- **E2E (live Supabase + live Gemini)**: seeded a ready document + 3 chunks and a
  real `generate_cram` job; the handler (Gemini `gemini-2.5-flash`, real chunk
  source + cram store) produced `quiz_set` mode `cram`, status `ready`, `job_id`
  matched, **4 flashcards** all `type='flashcard'` with non-empty
  `correct_answer`, **all citations resolved to the provided chunks**, non-empty
  `source_excerpt`s, and **zero `answer_options`**. Output
  `{result: ready, cards: 4, provider: gemini, model: gemini-2.5-flash,
  repaired: true}` — the live one-shot repair recovered a first response that
  failed validation. Fixture torn down (cascade).
- **Platform**: 57-test suite green; `generate_cram` registered in
  `DEFAULT_HANDLERS`; `generate_cram.py` / `SupabaseQuizStore.save_cards` import
  without provider keys.
- **Deferred (agreed)**: OpenAI primary generation — covered by US-RAG-007
  fake-provider tests. Cram rapid-review web UI → later web slice.
