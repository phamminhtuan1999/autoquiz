# Design

## Domain Model

Core entities:

- `Document`: uploaded PDF and processing status.
- `DocumentPage`: extracted text per page.
- `DocumentChunk`: retrieval unit with page range and metadata.
- `ChunkEmbedding`: provider-specific vector for a chunk.
- `AIJob`: durable backend work item.
- `QuizSet`: generated study artifact container.
- `Question`: normalized generated question or prompt.
- `AnswerOption`: normalized answer choice.
- `RAGQuestionAttempt`: answer attempt keyed to normalized question.
- `StudyReview`: generated review summary and recommendations.

## Application Flow

Future flow supported by this schema:

1. Web uploads PDF to `documents` bucket under `<user_id>/<document_id>/...`.
2. Web inserts `documents` and `ai_jobs(process_document)`.
3. Python backend processes document, writes pages/chunks/embeddings, and marks
   document `ready`.
4. Web inserts generation jobs for ready documents.
5. Python backend retrieves chunks through provider-specific RPCs and writes
   normalized generated content.

## Interface Contract

Storage:

- bucket: `documents`
- private
- PDF only
- 30 MB max
- first object path segment must be `auth.uid()`

RPC:

- `match_document_chunks_openai`
- `match_document_chunks_gemini`

Both require `p_user_id` and `p_document_id`, limiting retrieval at the SQL
level.

## Data Model

Implemented in `supabase/schema.sql`.

Important cutover choice:

- The legacy `question_attempts` table remains.
- New RAG attempts use `rag_question_attempts`.

## UI / Platform Impact

No immediate UI change. Later UI stories will replace legacy dashboard/history
surfaces with RAG records.

## Observability

`ai_jobs` includes status/progress/current step/error timestamps so later worker
stories can expose processing status and operational traces.

## Alternatives Considered

1. Rename legacy `question_attempts` now and use the design name for RAG
   attempts. Rejected: destructive cleanup belongs after replacement flows ship.
2. Use one embeddings table for all providers. Rejected: OpenAI and Gemini
   dimensions differ.
3. Vector-search globally and filter in app code. Rejected by the RAG design and
   authorization boundary.
