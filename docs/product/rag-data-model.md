# RAG Data Model

## Purpose

This document is the product-facing contract for the Lean RAG database
foundation. The implementation lives in `supabase/schema.sql`.

## Storage

PDF originals are stored in the private Supabase Storage bucket:

- bucket id: `documents`
- MIME type: `application/pdf`
- size limit: 30 MB
- recommended object path: `<user_id>/<document_id>/<original_filename>`

Storage RLS expects the first path segment to be the authenticated user's ID.

## Document Corpus

| Table | Purpose |
| --- | --- |
| `documents` | One uploaded PDF and its processing/index status. |
| `document_pages` | Extracted page text from Docling. |
| `document_chunks` | Retrieval chunks with source page ranges and metadata. |
| `chunk_embeddings_openai` | OpenAI `text-embedding-3-small` vectors, dimension 1536. |
| `chunk_embeddings_gemini` | Gemini embedding vectors, dimension 3072, for development/full-document fallback. |

Document statuses:

- `uploaded`
- `processing`
- `ready`
- `failed`
- `unsupported`

## Jobs

`ai_jobs` records backend work that the Python service will claim in
`US-RAG-003`.

Job types:

- `process_document`
- `generate_regular_quiz`
- `generate_cram`
- `generate_study_review`
- `generate_mock_exam`

Job statuses:

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

Worker contract:

- Jobs are claimed through service-role-only RPCs.
- `claim_ai_job` atomically claims one queued or stale running job and records
  `locked_by`, `locked_at`, and `attempt_count`.
- `complete_ai_job` and `fail_ai_job` only update jobs currently locked by the
  calling worker id.
- Retryable failures return to `queued` while `attempt_count < max_attempts`;
  non-retryable or exhausted jobs become `failed`.

## Generated Content

| Table | Purpose |
| --- | --- |
| `quiz_sets` | A generated regular, cram, study review, or mock set. |
| `questions` | Normalized prompts with source chunk/page/excerpt metadata. |
| `answer_options` | Normalized answer choices for MCQ-style questions. |
| `rag_question_attempts` | RAG attempt records keyed by `question_id` and `quiz_set_id`. |
| `study_reviews` | Generated review summaries, weak topics, and recommended actions. |

`rag_question_attempts` is intentionally namespaced: it coexisted with the legacy
`question_attempts` table during the cutover. That legacy table has since been
dropped (US-RAG-015), so the namespacing now simply distinguishes the RAG
attempts model from the retired one.

## Retrieval

Provider-specific RPCs search only inside a single user's selected document:

- `match_document_chunks_openai(query_embedding vector(1536), match_count, p_document_id, p_user_id)`
- `match_document_chunks_gemini(query_embedding vector(3072), match_count, p_document_id, p_user_id)`

Retrieval must never vector-search globally and filter in the application layer.

## RLS Contract

All RAG tables are owner-scoped by `user_id`.

Authenticated users can manage only their own:

- documents
- document pages
- document chunks
- embeddings
- AI jobs
- quiz sets
- questions
- answer options
- RAG attempts
- study reviews

The Python backend should use the Supabase service role for job execution and
must still write correct `user_id` values on every row.

## Cutover (completed)

The RAG schema was introduced additively: it did not migrate historical
generated content, and the legacy tables were kept until every replacement RAG
flow shipped. Once all four modes (regular, cram, study review, mock) were live,
US-RAG-015 retired the legacy surfaces and a separate cleanup migration
(`supabase/migrations/0001_retire_legacy_generated_content.sql`) **dropped** the
generated-content tables:

- `quizzes`
- legacy `question_attempts`
- `mock_exams`

Account and billing state — `profiles` (incl. `credits`), `payment_events`
(Stripe idempotency), and the `credit_transactions` ledger — was preserved
throughout (decisions 0010, 0015). Generated history was intentionally discarded,
not migrated.
