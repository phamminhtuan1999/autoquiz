# Validation

## Proof Strategy

Two proof surfaces, matching the two domains the slice touches:

- **`apps/ai`** has a `unittest` harness — the `grade_mock_exam` handler is proven
  by unit tests against fakes (answer source, grader, progress), covering rubric
  scoring, score clamping, blank-answer handling, aggregation, and the
  no-essays/empty paths. No new regression to the existing 82-test suite.
- **`apps/web`** has no unit harness (consistent with US-RAG-008b/009b) — the
  slice is proven by a type check plus live browser verification on the test
  account against live Supabase + the running AI worker. The generalized
  action/control/route must not regress the regular or cram path, so those
  triggers are exercised alongside the mock one.

The whole loop is additionally proven end-to-end live: generate a mock, take it,
submit, and confirm the worker's `grade_mock_exam` job scores the essay against
its rubric and the player renders it.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `grade_mock_exam`: grades an answered essay against its rubric (criteria scores summed, clamped to each criterion's max); a blank answer scores 0 with no model call; aggregates `total_score`/`max_total` across essays; a set with no essay questions returns `graded` with `essays=[]`; missing `quiz_set_id` raises; progress reported in order; provider/model/repaired/fell_back surfaced. |
| Integration | Handler registered in `DEFAULT_HANDLERS`; `SupabaseEssayAnswerSource` joins `questions` (`type='essay'`) to the latest `rag_question_attempts.answer_text` for the set. |
| E2E | Live (test account, dev server, live Supabase + worker): generate a mock → take MCQ + essay → submit → MCQ auto-scored + essay answer recorded → `grade_mock_exam` job scores the essay → player renders MCQ score + rubric feedback. |
| Platform | `apps/web` builds; the player route renders mock vs regular vs cram by `mode`; no console errors. Types: `tsc --noEmit` clean. |
| Performance | Grading is one structured call per answered essay (typical 2); bounded by the generation service timeouts. |
| Logs/Audit | The mock `ai_jobs` rows carry `job_type=generate_mock_exam` / `grade_mock_exam`; attempt + essay-answer writes are best-effort (warn, never block); the grade job records `provider`/`model`/`repaired`/`fell_back`. |

## Fixtures

- Test account `phamminhtuan1999@gmail.com` (preview verification).
- A ready, indexed document owned by the test account (seed a document + chunks
  via the service role if none exists).
- The AI worker running against live Supabase + Gemini to claim the
  `generate_mock_exam` and `grade_mock_exam` jobs.
- Unit fixtures: in-memory `FakeEssayAnswerSource`, `FakeGrader`
  (returns a canned `GenerationResult`), `RecordingProgress`.

## Commands

```text
cd apps/ai && python -m unittest discover -s tests -t . -q
cd apps/web && npx tsc --noEmit -p tsconfig.json
# Browser: generate a mock on a ready document, take + submit, confirm grading.
```

## Acceptance Evidence

Verified 2026-06-28.

- **Unit (`apps/ai`)**: `cd apps/ai/tests && PYTHONPATH=.. python3 -m unittest
  discover -p 'test_*.py'` → **Ran 96 tests … OK** (82 prior + 14 new
  `grade_mock_exam` tests). Covered: rubric scoring (criteria summed), score
  clamping to each criterion's rubric max, negative-score floor, blank-answer →
  0 with **no model call**, multi-essay aggregation, mixed answered/unanswered,
  no-essays → `graded` empty, missing `quiz_set_id` raises, criterion-max derived
  from levels, `repaired`/`fell_back` surfaced, progress ordered. `grade_mock_exam`
  present in `DEFAULT_HANDLERS`.
- **Types**: `cd apps/web && npx tsc --noEmit -p tsconfig.json` → **No errors
  found**. `mode="mock"` on the action/control, `enqueueMockGrading`, the
  `answerText`/nullable-`isCorrect` on `recordRagAttempt`, and the `RagMockPlayer`
  props all type-check; regular + cram callers compile unchanged.
- **Schema**: the additive `ai_jobs.job_type` CHECK was applied to the live DB;
  `pg_get_constraintdef` confirmed the constraint now admits `grade_mock_exam`
  alongside the existing five types.
- **E2E (live browser, test account, dev server :3000, live Supabase + the AI
  worker on Gemini)**: seeded a ready document + 3 chunks. (1) The ready document
  showed **three** triggers — "Generate quiz", "Generate cram", "Generate mock
  exam" (GraduationCap). (2) "Generate mock exam" enqueued a `generate_mock_exam`
  job; running the worker produced a `quiz_set` mode `mock` ("Mock exam (10 MCQ +
  2 essay)") with 10 `type='mcq'` + 2 `type='essay'` questions (each essay
  `metadata.max_points=10` + rubric). (3) The "Take mock exam" link opened the
  timed player: eyebrow "SOURCE-GROUNDED MOCK EXAM", a live **37:00** countdown,
  "Multiple choice · 10" + "Essays · 2" sections, MCQ cards with difficulty/topic/
  `p.1` `SourceRef`, and two essay textareas with word counts. (4) Answered all 10
  MCQ + wrote essay 1, left essay 2 blank → "11/12 answered". (5) "Submit exam"
  recorded **11 `rag_question_attempts`** (10 MCQ with `selected_option_id`/
  `is_correct`, 1 essay with `answer_text`) and enqueued a `grade_mock_exam` job.
  (6) Running the worker graded it: essay 1 **10/10** (criteria 3/3 + 3/3 + 4/4,
  each clamped to its rubric max, with comments + encouraging feedback), essay 2
  **0/10** deterministically ("No answer submitted.", **no model call**), total
  **10/20**; `provider=gemini`, `model=gemini-2.5-flash`, `repaired=false`. (7) The
  player polled the grade job and rendered the results: "Exam submitted", "MCQ:
  1/10 — 10%", "Essays: 10/20 pts", an "Essay grading" section with the
  per-criterion breakdown + feedback (and the blank essay's "No answer
  submitted."), and an "Answer review" of every MCQ with ✓/✗ + the correct option.
  **No console errors.**
- **Regression**: the regular "Generate quiz" trigger still enqueued a
  `generate_regular_quiz` job (`input` keys `document_id`/`num_questions`/
  `difficulty`) — the generalized dispatch did not regress the regular or cram
  path. Fixtures torn down (cascade).
- **Platform**: `apps/web` dev server compiled and served the mock player route
  by `quiz_sets.mode`; no console errors during the flow.
- **Deferred (agreed)**: retiring the legacy `mock_exams` / direct-Gemini mock
  flow → a later cutover step now that this path exists.
