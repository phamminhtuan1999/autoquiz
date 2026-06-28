# Exec Plan

## Goal

Surface the shipped US-RAG-009 cram backend in the web app: a per-document cram
trigger, a cited flashcard player for `mode='cram'` sets, and attempt recording —
reusing the US-RAG-008b enqueue+poll+player infrastructure.

## Scope

In scope:

- Generalize `enqueueQuizGeneration` with a `mode` (regular | cram) → job_type +
  input.
- Generalize `GenerateQuizControl` with a `mode` prop (labels/icon/enqueue);
  render a cram trigger beside the regular one for ready documents.
- `RagCramPlayer` (flashcard stepper, flip + self-rate + citation + attempt
  record), reusing the `Flashcard` / `SourceRef` / `DifficultyChip` composites.
- Branch the quiz-set player route on `quiz_sets.mode` (cram → cram player).
- Unit-free web validation: `tsc --noEmit` + live browser visual verification on
  the test account (generate → study → record).

Out of scope:

- Retiring legacy `generate-cram.ts` / `/dashboard/cram`; mock + study-review
  web; credits; spaced repetition.

## Risk Classification

Risk flags:

- Data model (writes `ai_jobs`/`rag_question_attempts`; reads `quiz_sets`/
  `questions`).
- Public contracts (the enqueue action signature + the player route consume the
  generation contract).
- Existing behavior (modifies the working regular enqueue action, control, and
  player route — must not regress the regular path).
- Weak proof (web has no unit harness; mitigated by `tsc` + live visual
  verification).

Hard gates:

- Data model: additive writes only — **no migration, no deletion**; reuses tables
  shipped in US-RAG-002 / written by US-RAG-008b. Session-client RLS scopes every
  read/write to the owner.

References US-RAG-008b (the pattern), US-RAG-009 (the producer), decisions
`0009`/`0010`.

## Work Phases

1. Discovery — read US-RAG-008b action/control/player + the `Flashcard`
   composite + the documents panel.
2. Design — generalize action/control, cram player, mode branch (this packet).
3. Validation planning — `validation.md`.
4. Implementation — enqueue mode, control mode, cram player, route branch, panel
   wiring.
5. Verification — `tsc --noEmit` green; live browser: generate a cram set, study
   cards (flip + rate), confirm a `rag_question_attempts` row; screenshot.
6. Harness update — `story add US-RAG-009b`, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- The regular quiz path would regress (shared action/control/route changes).
- Retiring the legacy cram flow becomes necessary in this slice.
- Attempt semantics for flashcards would need a schema change.
- Credit spend/refund would need to change here (US-RAG-011).
