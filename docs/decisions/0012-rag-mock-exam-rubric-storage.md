# 0012 Store RAG Mock-Exam Essay Rubrics in `questions.metadata`

Date: 2026-06-27

## Status

Accepted

## Context

`docs/product/rag-data-model.md` maps the legacy `mock_exams` table to "RAG mock
mode over `quiz_sets`, questions, **essay/rubric tables or a normalized
mock-exam extension**" — leaving the storage of essay rubrics deliberately open.
US-RAG-012 (the `generate_mock_exam` backend handler) is the first slice that has
to produce and persist rubric data, so the open question must be resolved before
code.

A RAG mock exam is a mix of MCQ questions (already fully modeled by `questions`
type `mcq` + `answer_options`, as in US-RAG-008) and essay questions, each of
which carries a grading rubric (criteria → scored levels), a max-points value, a
suggested time, and a reference sample answer. The normalized RAG schema
(US-RAG-002) ships `questions` with a `metadata jsonb` column and a `type` check
that already includes `essay`, but no dedicated rubric/essay table.

## Decision

Store RAG mock exams entirely over the existing normalized tables — **no new
table, no schema change**:

- MCQ questions → `questions` (`type='mcq'`) + `answer_options`, exactly as
  US-RAG-008.
- Essay questions → `questions` (`type='essay'`), with `prompt` (the essay
  question), `correct_answer` (the reference sample answer), the source citation
  columns, and **the rubric / max-points / suggested-minutes carried in
  `questions.metadata`** (jsonb), e.g.
  `{"rubric": {"criteria": [...]}, "max_points": 20, "suggested_minutes": 12}`.
  Essays have no `answer_options`.
- The exam is a `quiz_sets` row with `mode='mock'`; the suggested overall
  `time_limit_minutes` is a generation input echoed in the job output (durable
  per-essay timing lives in each essay's metadata).

## Alternatives Considered

1. **A dedicated `mock_exam_rubrics` (or `essay_questions`) table.** Rejected
   for this slice: it adds schema surface and a migration for data whose only
   consumer so far is the not-yet-built mock session/grading flow. `metadata`
   jsonb is the additive path the normalized model already affords, and a future
   session story can normalize rubrics into a table if querying them relationally
   proves necessary.
2. **Reuse the legacy `mock_exams` jsonb blob.** Rejected: the clean cutover
   (decision 0010) routes new generation through the RAG tables and retires
   `mock_exams`; writing new content there would re-grow the legacy path.
3. **Encode the rubric inside `explanation` text.** Rejected: the rubric is
   structured, gradable data; flattening it to prose loses the criteria/levels
   structure the grading flow needs.

## Consequences

Positive:

- US-RAG-012 stays additive (no schema change, no migration) and consistent with
  US-RAG-008/009/010.
- MCQ persistence is reused verbatim from US-RAG-008; only an essay insert path
  is new.
- The mock exam is a first-class `quiz_sets` row, listable beside the other
  modes.

Tradeoffs:

- Rubrics are not relationally queryable until/unless a later story normalizes
  them; they are read as a whole `metadata` object per essay question.
- Exam-level timing is derived (per-essay `suggested_minutes` + an MCQ
  allowance) rather than stored on the set, since `quiz_sets` has no duration
  column. A future mock-session story owns durable exam-level state.

## Follow-Up

- US-RAG-012: implement `generate_mock_exam` writing this shape.
- Later web slice: RAG mock-exam session, attempt, and rubric-backed essay
  grading commands (replacing `mock-exam-session.ts`), reading the rubric from
  `questions.metadata`.
- US-RAG-011: set the real `credit_cost` for mock generation (0 until then).
