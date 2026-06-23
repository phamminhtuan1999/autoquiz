# Design

## Domain Model

Preserved domains:

- User account.
- Profile.
- Credit balance.
- Payment idempotency.

Retired legacy generated-content domains:

- Legacy quiz JSON rows.
- Legacy cram JSON rows.
- Legacy mock exam JSON rows.
- Legacy index-based attempts.

New RAG-generated-content domains are defined in `docs/product/lean-rag-mvp.md`
and will be implemented by later stories.

## Application Flow

Current direct flows remain in place until replacements ship:

- Upload PDF text in browser -> direct Gemini regular quiz.
- Upload PDF text in browser -> direct Gemini cram mode.
- Upload PDFs in browser -> direct Gemini mock exam.

Replacement flows:

- Upload PDF -> create document/job -> process/index -> generate RAG quiz/cram.
- Complete RAG quiz -> save question-keyed attempts -> generate study review.
- After the core RAG path is stable -> generate RAG mock exam.

## Interface Contract

Legacy generated-content URLs may be retired after replacement surfaces exist.
If users reach old URLs after retirement, the app should render a clear
retired/empty state and link to the RAG upload flow.

## Data Model

Do not migrate:

- `quizzes`
- old `question_attempts`
- `mock_exams`

Preserve:

- Supabase auth users.
- `profiles`, including `credits`.
- `payment_events` or equivalent Stripe idempotency state.
- Payment success/webhook behavior.

Future cleanup migration:

- Must be separate from RAG schema creation.
- Must state generated history is intentionally discarded.
- Must not touch account or billing records.

## UI / Platform Impact

Dashboard history and mode-specific links will move from legacy generated-content
tables to RAG records as each replacement story lands.

## Observability

Later cleanup should log or trace:

- cutover migration start/finish
- table cleanup counts when destructive cleanup happens
- credit balance preservation checks

## Alternatives Considered

1. Migrate old `quizzes` and `mock_exams` into RAG tables. Rejected for speed:
   the user does not need old generated data.
2. Drop legacy tables immediately. Rejected: replacement flows do not exist yet.
3. Keep compatibility forever. Rejected: it preserves complexity that the clean
   cutover intentionally avoids.
