# Exec Plan

## Goal

Surface the shipped US-RAG-012 mock backend in the web app and close the loop
with rubric-backed essay grading: a per-document mock trigger, a timed MCQ+essay
player for `mode='mock'` sets, MCQ auto-grade + essay-answer capture, and a
`grade_mock_exam` worker job that scores essays against their stored rubrics —
reusing the US-RAG-008b enqueue+poll+player infrastructure.

## Scope

In scope:

- Generalize `enqueueQuizGeneration` with `mode="mock"` → `generate_mock_exam`
  (counts clamped); a `mode="mock"` `GenerateQuizControl` trigger per ready
  document.
- `RagMockPlayer` (timed, exam-style MCQ + essay textareas, single submit, source
  citations), reusing `SourceRef` / `DifficultyChip`.
- Extend `recordRagAttempt` for essay answers (`answerText`, nullable
  `isCorrect`); a new `enqueueMockGrading` server action.
- Branch the player route on `mode='mock'`; add `type` + `metadata` to its
  question select.
- Backend: `grade_mock_exam` handler (answer source + grader + progress, behind
  protocols), `SupabaseEssayAnswerSource`, register in `handlers.py`, unit tests.
- Schema: additive `ai_jobs.job_type` CHECK extension for `grade_mock_exam`,
  applied to the live DB.
- Decision 0013 (grade storage + CHECK extension).

Out of scope:

- Retiring legacy `mock_exams` / direct-Gemini mock; credits (US-RAG-011);
  server-enforced timing / session resume; grade history.

## Risk Classification

Risk flags:

- **Data model** — extends the `ai_jobs.job_type` CHECK on the live DB (additive,
  no data loss / backfill). Reuses all other tables (additive writes).
- **External systems** — LLM grading via the US-RAG-007 generation/repair/
  fallback service.
- **Public contracts** — the enqueue action signature (`mode="mock"`), the new
  grade action + job type, and the player route consume the generation contract.
- **Existing behavior** — generalizes the shared enqueue action / control /
  player route again; must not regress regular + cram.
- **Multi-domain** — `apps/web` (player, actions, route) + `apps/ai` (grade job).
- **Weak proof** — web has no unit harness; mitigated by `tsc` + live browser E2E.

Hard gates:

- **Data model**: the CHECK extension is additive only — **no migration of
  existing rows, no deletion**. Confirmed scope (whole slice) + grade-storage
  approach (`ai_jobs.output`) with the human before implementation; recorded as
  decision 0013.

References US-RAG-008b/009b (the pattern), US-RAG-012 (the producer), US-RAG-007
(the grading service), decisions `0012` (rubric storage), `0013` (grade storage).

## Work Phases

1. Discovery — read the 012 backend, the 008b/009b action/control/player, the
   player route, the schema, and the product/mock docs. (done)
2. Design — generalize action/control, mock player, grade action + handler, mode
   branch, grade storage (this packet + decision 0013).
3. Validation planning — `validation.md`.
4. Implementation — schema CHECK; `grade_mock_exam` handler + IO + register +
   tests; enqueue mode + grade action + attempt extension; mock player; route
   branch + panel wiring.
5. Verification — `apps/ai` unit suite green; `tsc --noEmit` green; live browser:
   generate a mock, take it (MCQ + essay), submit, confirm the grading job scores
   the essay, render the score + feedback; regular/cram regression probe.
6. Harness update — `decision add 0013`, `story add US-RAG-012b`, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- Grade storage would need a new table/columns after all (schema beyond the
  additive CHECK).
- The regular or cram path would regress (shared action/control/route changes).
- Essay-answer or grade semantics would need a `rag_question_attempts` schema
  change.
- Credit spend/refund would need to change here (US-RAG-011).
- The grading model cannot produce a usable rubric score even after repair +
  fallback (escalate the prompt/schema rather than ship silent zeros).
