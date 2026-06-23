# Overview

## Current Behavior

AutoQuiz currently stores generated content in legacy JSON-heavy tables:

- `quizzes` stores regular quiz JSON and cram mode JSON.
- `question_attempts` points to legacy quiz rows by `quiz_id` and
  `question_index`.
- `mock_exams` stores generated mock exam content, answers, scores, and
  feedback as JSON.

The user has confirmed that old generated quiz and mock-exam history does not
need to be preserved.

## Target Behavior

The product contract defines a clean cutover to the RAG data model:

- Preserve auth, profiles, credits, Stripe payment idempotency, and account
  metadata.
- Do not migrate historical generated `quizzes` or `mock_exams`.
- Route new generated content through RAG documents, jobs, quiz sets,
  normalized questions/options, attempts, study reviews, and future RAG mock
  records.
- Retire legacy generated-content routes/actions only after replacements exist.

## Status

implemented

## Affected Users

- Existing users keep their accounts and credits.
- Existing generated quiz/mock-exam history may disappear from new dashboard
  surfaces after cutover.
- Developers get a clear map for what to preserve and what to retire.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md`
- `docs/product/rag-clean-cutover.md`
- `docs/decisions/0010-rag-repo-split-clean-cutover.md`

## Non-Goals

- Implement RAG schema.
- Drop legacy tables.
- Delete legacy routes/actions.
- Migrate historical generated content.
