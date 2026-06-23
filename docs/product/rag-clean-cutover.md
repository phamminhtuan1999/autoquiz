# RAG Clean Cutover

## Decision Summary

AutoQuiz will not migrate old generated quiz, cram, or mock-exam history into
the Lean RAG data model. The faster accepted path is a clean cutover:

- Preserve account, auth, profile, credit balance, Stripe idempotency, and
  payment history needed for billing correctness.
- Retire old generated-content tables, routes, actions, and UI history surfaces
  as the new RAG equivalents land.
- Build all new generation against normalized RAG records.

## Preserve

These records and flows remain product truth through the cutover:

| Area | Keep | Reason |
| --- | --- | --- |
| Auth | Supabase auth users and callback route | Users must keep access. |
| Profiles | `profiles.id`, `email`, `full_name`, `university`, `credits` | Credits and user metadata remain valid. |
| Payments | Stripe checkout, webhook signature verification, `payment_events` idempotency | Prevent duplicate credits and preserve billing correctness. |
| Credit balance | Existing `profiles.credits` until `credit_transactions` replaces direct mutation | Users should not lose purchased credits. |
| Leaderboard identity | Profile university/name fields | Can feed later RAG attempt analytics. |

## Retire

These are legacy generated-content surfaces. They should not be migrated into
the RAG model:

| Legacy surface | Current role | RAG replacement |
| --- | --- | --- |
| `quizzes` table | Stores regular quiz JSON and cram JSON in one column | `quiz_sets`, `questions`, `answer_options`, `study_reviews` |
| Legacy `question_attempts.quiz_id` | Tracks attempts by quiz row and question index | RAG `question_attempts.question_id` + `quiz_set_id` |
| `mock_exams` table | Stores generated exam content, answers, and grading JSON | RAG mock mode over `quiz_sets`, questions, essay/rubric tables or a normalized mock-exam extension |
| `generate-quiz.ts` | Direct browser-text-to-Gemini regular quiz action | Create `generate_regular_quiz` AI job from a ready document |
| `generate-cram.ts` | Direct browser-text-to-Gemini cram action | Create `generate_cram` AI job from a ready document |
| `generate-mock-exam.ts` | Direct multi-PDF Gemini mock exam action | Create `generate_mock_exam` AI job after core RAG path |
| `mock-exam-session.ts` | Mutates legacy mock exam state and grades essays | RAG mock session/attempt/grading commands |
| `record-answer.ts` | Inserts index-based legacy attempts | RAG attempt command keyed by question ID |
| `/dashboard/quizzes/[quizId]` | Renders legacy JSON quiz/cram rows | RAG quiz-set result and attempt surfaces |
| `/dashboard/cram` session storage | Displays cram data from browser session storage | RAG cram result page backed by `quiz_sets` / `study_reviews` |
| `/dashboard/mock-exam/*` | Legacy mock exam list/session/results | RAG mock exam surfaces after `US-RAG-012` |
| `/api/mock-exam/*` | Legacy mock exam API reads | RAG mock exam API after `US-RAG-012` |

## Cutover Sequence

1. Keep legacy paths running until the RAG replacement for that mode exists.
2. Add the normalized RAG schema in `US-RAG-002`.
3. Add `credit_transactions` in `US-RAG-011` and keep current credit balance
   intact.
4. Ship RAG regular quiz and attempt flow in `US-RAG-008`.
5. Remove or hide legacy quiz history links when RAG regular quiz is ready.
6. Ship RAG cram in `US-RAG-009`, then remove session-storage cram flow.
7. Ship RAG study review in `US-RAG-010`, using RAG attempts as input.
8. Ship RAG mock exam in `US-RAG-012`, then retire legacy mock exam routes,
   actions, and table usage.
9. Add cleanup migration only after all replacement paths are released.

## Database Cutover Rules

- Do not write a historical data migration from `quizzes` to `quiz_sets`.
- Do not write a historical data migration from `mock_exams` to RAG mock records.
- Do not delete `profiles`, auth users, Stripe payment idempotency records, or
  credit balances.
- Do not drop old generated-content tables in the same migration that creates
  the new RAG schema. First release replacement flows, then drop legacy tables
  in a later explicit cleanup.
- Any destructive cleanup migration must state that generated history is
  intentionally discarded and must not touch billing/account records.

## User-Facing Behavior

- New generations use the RAG flow once the replacement mode is available.
- Old generated quiz/cram/mock history may disappear from dashboard surfaces at
  cutover.
- Credits stay intact.
- Payment success and duplicate webhook handling stay intact.
- If a user opens an old generated-content URL after retirement, show a clear
  empty/retired state and a link to upload a document for the new RAG flow.

## Validation Requirements

Before the clean cutover is considered complete:

- RLS checks prove users can only access their own RAG documents, jobs, quiz
  sets, questions, attempts, reviews, and mock exam records.
- Credit balance preservation is tested before and after `credit_transactions`
  is introduced.
- Stripe duplicate event protection still passes.
- Dashboard no longer depends on legacy generated-content tables for new work.
- Legacy generated-content cleanup does not affect auth, profiles, credits, or
  payment idempotency.
