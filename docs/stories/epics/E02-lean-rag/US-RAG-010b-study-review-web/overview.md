# Overview

## Current Behavior

US-RAG-010 ships the backend `generate_study_review` handler: it turns a
student's `rag_question_attempts` for a document (the weak-area signal) plus the
document's retrieval chunks (grounding) into a normalized `study_reviews` row
keyed to a `quiz_set` (mode `study_review`) — an overall `summary`, a list of
cited `weak_topics`, and `recommended_actions`.

US-RAG-008b/009b/012b ship the web path for the **regular**, **cram**, and
**mock** modes — per-document generate triggers, an `ai_jobs` enqueue + poll, and
cited players. But **study review has no web surface**: nothing enqueues a
`generate_study_review` job, and the quiz-set route only renders MCQ / flashcard
/ mock questions, never a review report.

## Target Behavior

Wire the shipped study-review backend into the UI, reusing the US-RAG-008b
enqueue+poll pattern:

- A per-ready-document **"Generate review"** trigger that enqueues a
  `generate_study_review` `ai_jobs` row and polls it, then links to the report.
  Because a review needs prior practice, the trigger is gated: the enqueue action
  pre-checks the document has at least one `rag_question_attempt` and returns a
  friendly "take a quiz first" message otherwise (no failed job).
- The quiz-set route renders a **cited study-review report** for
  `mode='study_review'` sets: the summary (with an attempts/accuracy readout), a
  list of weak topics — each with why it's weak, a recommended action, and a
  source citation (page + excerpt) — and a list of recommended next actions. A
  student who aced everything sees a positive "no weak topics" state.

Regular MCQ, cram, and mock sets keep rendering their existing players unchanged.
After this slice, all four RAG modes are usable in the UI.

## Affected Users

- Student (document owner) — after practicing on a document, they can generate a
  grounded study review that names their weak topics, says why, and links each to
  the source page, with concrete next steps.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md` (Core Flow 7–8, `study_review` generation mode)
- `docs/product/rag-data-model.md` (`quiz_sets` mode `study_review`,
  `study_reviews`, `rag_question_attempts`)
- `docs/product/rag-clean-cutover.md` (review result page backed by `quiz_sets`)

## Non-Goals

- Generating a review from a single quiz attempt scoped by `source_quiz_set_id`
  (the backend supports it; this slice reviews all of a document's attempts).
- Credit spend on generation (US-RAG-011) — the enqueue records `credit_cost=0`.
- Re-review history / diffing reviews over time — the route shows the most recent
  review for the set.
- Editing or acting on recommended actions inside the app.
