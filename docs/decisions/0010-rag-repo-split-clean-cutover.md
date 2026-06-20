# 0010 Split RAG App and Use Clean Data Cutover

Date: 2026-06-19

## Status

Accepted

## Context

The Lean RAG MVP adds a Python FastAPI AI backend alongside the existing Next.js
app. The plan had two open architecture questions: whether to keep the web app
at the repository root or split into `apps/web` and `apps/ai`, and whether to
migrate existing `quizzes` / `mock_exams` data or skip legacy data migration.

The human clarified:

- Split the codebase into two apps.
- Old generated quiz/mock-exam data does not need to be preserved.
- Mock Exam should be developed right after the core RAG path, not as part of
  the very first release slice.

## Decision

Use an `apps/web` and `apps/ai` split for RAG development.

Use a clean data cutover instead of preserving old generated content. The faster
path is to build the normalized RAG schema and new generation flows directly,
then retire or ignore old `quizzes` / `mock_exams` data rather than writing a
compatibility migration for historical records.

Mock Exam remains in the development plan, but it should follow the regular
quiz, cram mode, study review, and credit/job substrate instead of blocking the
first core RAG implementation.

## Alternatives Considered

1. Keep Next.js at repository root and add only `apps/ai`. Rejected: the human
   chose a two-app split.
2. Migrate historical `quizzes` and `mock_exams` into the normalized RAG model.
   Rejected for speed: old generated data is not required.
3. Ship Mock Exam in the first core RAG slice. Rejected for sequencing: develop
   it right after the core RAG path is working.

## Consequences

Positive:

- Cleaner web/backend ownership boundaries.
- Faster implementation because no legacy generated-data migration is required.
- Mock Exam can reuse the proven RAG/job/provider/credit substrate.

Tradeoffs:

- Repo split will require path, script, TypeScript, lint/build, and deployment
  configuration updates.
- Existing generated content may not appear in the new RAG surfaces unless a
  later compatibility task is explicitly added.
- Clean cutover still needs careful handling of tables and UI links so stale
  screens do not point users at retired data.

## Follow-Up

- US-RAG-014: split the repository into `apps/web` and `apps/ai`.
- US-RAG-015: perform clean RAG data cutover and retire legacy generated-data
  paths without historical migration.
- Keep US-RAG-012 as the Mock Exam task immediately after the core RAG path.
