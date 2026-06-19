# 0009 Adopt Lean RAG MVP Architecture

Date: 2026-06-19

## Status

Accepted

## Context

The current AutoQuiz implementation sends browser-extracted PDF text directly to
Gemini-backed server actions for regular quiz, cram, and mock exam generation.
That path is simple, but it cannot reliably provide source citations, repeatable
retrieval, document processing status, or provider fallback. The supplied Lean
RAG design calls for saved original PDFs, Supabase Storage/Postgres/pgvector,
a Python FastAPI AI backend, Docling extraction, chunking, embeddings, RAG
retrieval, OpenAI primary generation, and Gemini fallback.

The source design marks Mock Exam as Phase 2. The accepted planning scope for
this repo includes Mock Exam tasks so it can be migrated to the same RAG,
citation, provider, and credit contracts as regular quiz and cram mode.

## Decision

Adopt the Lean RAG architecture as the target direction for AutoQuiz:

- Keep Next.js as the browser app and product surface.
- Use Supabase Auth, Postgres, RLS, Storage, and pgvector as the core data
  platform.
- Add a Python FastAPI AI backend for PDF processing, job execution, provider
  calls, retrieval, and generation.
- Store original PDFs, document pages, document chunks, provider-specific
  embeddings, AI jobs, normalized quiz sets, questions, answer options,
  attempts, study reviews, and credit transactions.
- Use OpenAI as production primary for generation and embeddings.
- Use Gemini as generation fallback and optional development/full-document
  embedding fallback.
- Require source chunk validation for generated regular quiz, cram, study
  review, and mock exam output.

## Alternatives Considered

1. Keep all generation in Next.js server actions and add citations directly to
   prompts. Rejected: prompt-only citations are not enough proof for grounded
   retrieval and do not solve long documents or provider fallback cleanly.
2. Use an external vector database. Rejected for MVP: Supabase pgvector is
   already aligned with the app's database and authorization model.
3. Keep Mock Exam outside the RAG scope. Rejected for planning after human
   clarification: Mock Exam should be included in the task plan even if it ships
   after the first regular quiz/cram/review slice.

## Consequences

Positive:

- Generation can be grounded in retrieved source chunks with validated
  citations.
- Long-document handling moves out of prompt slicing and into document indexing.
- Provider fallback becomes explicit and testable.
- Credit spend/refund can be tied to durable jobs and idempotent transactions.
- Regular quiz, cram, study review, and mock exam can share a single document
  and retrieval substrate.

Tradeoffs:

- Adds a second runtime and deployment target.
- Requires migrations and possible compatibility work for existing `quizzes`,
  `question_attempts`, and `mock_exams` data.
- Requires a RAG evaluation suite before quality claims are credible.
- Requires careful RLS and job-claim design so the Python backend does not
  weaken user data isolation.

## Follow-Up

- US-RAG-001: turn this decision into executable high-risk story packets.
- US-RAG-002: design schema/RLS/storage migration before implementation.
- US-RAG-013: define the minimum RAG quality/evaluation gate before release.
