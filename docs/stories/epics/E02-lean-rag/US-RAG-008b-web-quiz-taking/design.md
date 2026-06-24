# Design

## Surfaces

1. **Generate trigger** (on a `ready` document) — `GenerateQuizControl` client
   component rendered per ready row in the documents panel. Calls a server
   action to enqueue the job, then polls `ai_jobs` (`job_type=generate_regular_quiz`)
   until terminal. On `succeeded`, reads `output.quiz_set_id` and links to the
   player; on `failed`, shows `error_message`.
2. **Cited quiz player** — route `/dashboard/quiz-sets/[quizSetId]`. A server
   component loads the set (RLS-scoped to the user) and renders the interactive
   `RagQuizPlayer`.
3. **Attempt recording** — `recordRagAttempt` client action writes one
   `rag_question_attempts` row per answered question.

## Data Flow

```
ready document
   │  enqueueQuizGeneration(documentId, numQuestions, difficulty)  [server action]
   ▼
ai_jobs(job_type=generate_regular_quiz, input={document_id,...}, status=queued)
   │  AI worker claims + runs generate_regular_quiz (US-RAG-008)
   ▼
quiz_sets(mode=regular) + questions(type=mcq, cited) + answer_options(A–D)
   │  poll ai_jobs → succeeded → output.quiz_set_id
   ▼
/dashboard/quiz-sets/[quizSetId]  (server read: quiz_sets + questions + answer_options)
   │  RagQuizPlayer (client): pick option → reveal correct + explanation + SourceRef
   ▼
recordRagAttempt → rag_question_attempts(question_id, quiz_set_id, selected_option_id, is_correct)
```

## Components

- **`enqueueQuizGeneration` (server action)** — auth via session client; verify
  the document belongs to the user and is `ready`; insert the `ai_jobs` row
  (RLS-scoped). Returns `{ jobId }`. Inserts only — no credit deduction
  (US-RAG-011 owns credits).
- **`GenerateQuizControl` (client)** — "Generate quiz" button + small
  num-questions/difficulty choice; after enqueue, polls `ai_jobs` every 4s
  (mirrors `DocumentsPanel`), shows a progress bar from `progress`/`current_step`,
  and on success renders a "Take quiz →" link to the player.
- **`/dashboard/quiz-sets/[quizSetId]/page.tsx` (server)** — load the set,
  its questions (ordered), and their options; `notFound()` if missing or not
  owned. Passes a typed view-model to the player.
- **`RagQuizPlayer` (client)** — reuses DESIGN.md token styling and `SourceRef`.
  Per question: render `answer_options` as selectable buttons; on select, lock
  the question, mark correct/incorrect from `is_correct`, reveal explanation +
  `SourceRef(page, excerpt)`, and call `recordRagAttempt`. A running tally + a
  final score summary at the end. Lucide icons (no emoji), per DESIGN.md.
- **`recordRagAttempt` (client action)** — insert into `rag_question_attempts`;
  best-effort (a failed insert logs and returns an error but never blocks taking
  the quiz).

## Reused / Unchanged

- `SourceRef` (`components/quiz/source-ref.tsx`) — already token-based; used as-is.
- `DifficultyChip` — used to badge each question's difficulty.
- `DocumentsPanel` enqueue+poll pattern — the model for `GenerateQuizControl`.
- Legacy `generate-quiz.ts`, `quizzes`, `question_attempts`, `record-answer.ts`,
  `quizzes/[quizId]` route — **left intact**.

## Data Model

No schema change. Reads `quiz_sets`, `questions`, `answer_options`; writes
`ai_jobs` (enqueue) and `rag_question_attempts` (one row per answered question).
All access goes through the user's session client, so RLS scopes every read and
write to the owner.

## RLS / Authorization

- The enqueue action and player reads use the **session** Supabase client (not
  service role), so RLS enforces ownership; the action additionally checks the
  document is `ready` before queueing.
- `rag_question_attempts` insert carries `user_id = auth.uid()`; RLS policies on
  the RAG tables (US-RAG-002) restrict rows to the owner.

## Observability

The job's `progress` / `current_step` / `error_message` drive the trigger UI
(same as document processing). The player surfaces the served citation for every
question, making grounding visible to the student.

## Alternatives Considered

1. **Replace the legacy quiz path now.** Rejected: "existing behavior" is a hard
   gate; a clean cutover (retire `quizzes`/`question_attempts`) is its own story.
   Coexistence keeps blast radius small and reversible.
2. **Render the quiz from the job output JSON directly.** Rejected: the
   normalized `questions`/`answer_options` tables are the durable contract and
   carry the option ids needed for `rag_question_attempts.selected_option_id`.
3. **Client-side enqueue (like `DocumentsPanel`).** A server action was chosen
   for the enqueue so the `ready`-status check and ownership validation run on
   the server; polling stays client-side.
