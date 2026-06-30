# Exec Plan

## Goal

Surface the shipped US-RAG-010 study-review backend in the web app: a
per-document "Generate review" trigger (gated on existing attempts) and a cited
weak-topics report for `mode='study_review'` sets — reusing the US-RAG-008b
enqueue+poll infrastructure. Completes all four RAG modes in the UI.

## Scope

In scope:

- Generalize `enqueueQuizGeneration` with `mode="study_review"` →
  `generate_study_review`, plus an attempts pre-check that returns a friendly
  inline error instead of queueing a doomed job.
- Generalize `GenerateQuizControl` with a `study_review` copy entry.
- `RagStudyReview` (server-rendered report: summary + cited weak topics +
  recommended actions), reusing the `SourceRef` composite.
- Branch the quiz-set route on `mode='study_review'` (fetch the `study_reviews`
  row, render the report); wire the trigger into the documents panel.
- Validation: `tsc --noEmit` + live browser verification on the test account
  (seed attempts → generate → render).

Out of scope:

- Set-scoped reviews (`source_quiz_set_id`); credits; review history; acting on
  recommendations in-app.

## Risk Classification

Risk flags:

- Public contracts (the enqueue action gains a mode + a gate; the route consumes
  the review contract).
- Existing behavior (modifies the shared regular/cram/mock enqueue action,
  control, and route — must not regress them).
- Weak proof (web has no unit harness; mitigated by `tsc` + live verification).

Hard gates:

- None. Additive reads/writes only — **no schema change, no migration, no
  deletion**. Reuses tables shipped in US-RAG-002 and written by US-RAG-010.

References US-RAG-008b/009b/012b (the pattern), US-RAG-010 (the producer),
decisions `0009`/`0010`.

## Work Phases

1. Discovery — the 010 backend + `study_reviews` shape, the 008b/012b
   action/control/route, the `SourceRef` composite, the documents panel. (done)
2. Design — generalize action/control, review report, route branch (this packet).
3. Validation planning — `validation.md`.
4. Implementation — enqueue mode + attempts gate, control copy, report component,
   route branch, panel wiring.
5. Verification — `tsc --noEmit` green; live browser: seed attempts, generate a
   review, render the report; regular/cram/mock regression probe; screenshot.
6. Harness update — `story add US-RAG-010b`, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- The regular/cram/mock path would regress (shared action/control/route changes).
- Attempt or review semantics would need a schema change.
- Credit spend/refund would need to change here (US-RAG-011).
