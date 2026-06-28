# Validation

## Proof Strategy

The handler orchestration (chunk loading, MCQ + essay citation
validation/mapping, drop rules, the zero-survivor raise, persistence calls) sits
behind `ChunkSource` / `MockGenerator` / `MockStore` seams, so it is proven
deterministically with fakes. The real path — live Gemini generation + real
Supabase chunk read and quiz/MCQ/essay writes — is proven by one E2E against
live infrastructure, with teardown.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `mock_schema` bounds each MCQ and essay `source_chunk` to the chunk count and the arrays to num_mcq/num_essay, with the essay item carrying rubric/max_points/suggested_minutes and no options; `build_mock_prompt` numbers chunks + shows pages + the MCQ/essay split + difficulty. Handler: happy path persists a `quiz_set` (mode `mock`, job_id) + maps each MCQ citation to the right `chunk_id`/page/excerpt with 4 options, and each essay to `type='essay'` with `correct_answer`=sample + rubric in metadata + citation; drops an MCQ whose citation is out of range; drops an MCQ with != 4 options; drops an essay whose citation is out of range; drops an essay with a blank prompt; zero total valid questions → raises and persists nothing; no chunks → raises before generating; missing `document_id` → raises; `num_mcq`/`num_essay` clamped; `time_limit_minutes` defaulted when absent and echoed in output; progress reported in order. |
| Integration | `SupabaseQuizStore.save_questions` reused for MCQs (`type='mcq'` + `answer_options`); `SupabaseQuizStore.save_essays` inserts `questions` with `type='essay'`, `correct_answer`=sample, rubric in `metadata`, and **no** `answer_options`; `create_quiz_set` writes `mode='mock'`. (Exercised through the E2E.) |
| E2E | Live Supabase + live Gemini: seed a ready document + chunks, create a real `generate_mock_exam` job row, run the handler → a `quiz_set` (mode `mock`, `job_id` match) with ≥1 `mcq` question (4 `answer_options`, one correct) and ≥1 `essay` question (`type='essay'`, non-empty `correct_answer`, `metadata.rubric.criteria` present, **zero** `answer_options`), every persisted question citing a provided chunk with a non-empty `source_excerpt`, and a `time_limit_minutes` in the output. Teardown (cascade). |
| Platform | `apps/ai` unit suite passes; modules import without provider keys; handler registered in `DEFAULT_HANDLERS`. |
| Logs/Audit | Job output `{quiz_set_id, mcq, essays, time_limit_minutes, provider, model, repaired, fell_back}`. |

## Fixtures

- `FakeChunkSource`, `FakeMockGenerator` (returns a `GenerationResult` or
  raises), `RecordingMockStore`, `RecordingProgress`.
- Live Gemini key (`AUTOQUIZ_AI_GEMINI_API_KEY`) + live Supabase service role.
- A borrowed `profiles` id as the owner; a seeded document + biology chunks.

## Commands

```text
cd apps/ai && PYTHONPATH=. python3 -m unittest discover -s tests
# E2E: real Gemini generation + real Supabase persistence on a seeded document
```

## Acceptance Evidence

Verified 2026-06-27.

- **Unit**: `python3 -m unittest discover -s tests` → **82 tests pass** (69 prior
  + **13 generate_mock_exam**). Covers `mock_schema` (bounds each MCQ/essay
  `source_chunk` to the chunk count + arrays to num_mcq/num_essay; MCQ item has
  options, essay item has a rubric and no options) and `build_mock_prompt`
  (numbered chunks + MCQ/essay counts + difficulty), plus the handler matrix:
  happy path persists a `quiz_set` (mode `mock`, job_id) with MCQs mapped to
  chunk id/page/excerpt + `correct_answer`, and essays with `correct_answer`=
  sample + rubric retained; out-of-range MCQ citation drop; wrong-option-count
  drop; out-of-range essay citation drop; blank-prompt / no-rubric essay drop;
  zero valid questions → raise (nothing persisted); no chunks → raise before
  generating; missing `document_id` → raise; `num_mcq`/`num_essay` clamped;
  `time_limit_minutes` defaulted-then-echoed and explicit-input honored; ordered
  progress.
- **E2E (live Supabase + live Gemini)**: seeded a ready document + 3 photosynthesis
  chunks and a real `generate_mock_exam` job (`num_mcq=4, num_essay=1`). The
  handler (Gemini `gemini-2.5-flash`, real chunk source + mock store) produced a
  `quiz_set` mode `mock`, status `ready`, `job_id` matched, `credit_cost=0`, with
  **4 MCQ questions** (each with 4 `answer_options` and exactly one `is_correct`)
  and **1 essay question** (`type='essay'`, non-empty sample `correct_answer`,
  `metadata.rubric.criteria` = 3 grounded criteria, **zero `answer_options`**);
  **every question cited a provided chunk** with a non-empty `source_excerpt`;
  output `time_limit_minutes=21`. Output `{result: ready, mcq: 4, essays: 1,
  provider: gemini, model: gemini-2.5-flash, repaired: true}` — the live one-shot
  repair recovered a first response that failed the nested schema. Fixture torn
  down (cascade).
- **Platform**: 82-test suite green; `generate_mock_exam` registered in
  `DEFAULT_HANDLERS`; `generate_mock_exam.py` / `SupabaseQuizStore.save_essays`
  import without provider keys.
- **Deferred (agreed)**: OpenAI primary generation — covered by US-RAG-007
  fake-provider tests. Mock-exam session / essay grading UI → later web slice.
