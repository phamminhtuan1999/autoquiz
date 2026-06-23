# Initiative 0002 - Lean RAG MVP

Date: 2026-06-19

## Source

- User prompt: plan development tasks for `autoquiz_unified_lean_rag_mvp_system_design.md`, install Harness CLI, include Cram Mode and Mock Exam.
- Source design: `autoquiz_unified_lean_rag_mvp_system_design.md`.

## Project Summary

Turn AutoQuiz from direct browser PDF extraction plus Gemini prompts into a
grounded document-study platform. Users upload PDFs, the system saves the
original file, indexes text with a Python AI backend, stores chunks and
embeddings in Supabase/pgvector, and generates regular quizzes, cram content,
study reviews, and mock exams from retrieved source chunks with citations.

The design source frames Mock Exam as Phase 2, but the accepted planning scope
for this initiative includes Mock Exam tasks so it can be developed against the
same RAG, citation, provider, and credit contracts instead of remaining on the
current direct-prompt path.

## Risk Classification

Lane: high-risk.

Risk flags:

- Auth and authorization: all document, job, quiz, attempt, review, and mock
  exam records must remain owner-scoped under Supabase RLS.
- Data model: new document, page, chunk, embedding, job, quiz, question,
  attempt, review, and credit transaction tables are required.
- External systems: Supabase Storage/pgvector, Python FastAPI deployment,
  OpenAI, Gemini, Docling, Stripe, and possible Railway/Render deployment.
- Public contracts: current quiz/cram/mock-exam flows move from immediate
  server actions to document/job-backed generation.
- Existing behavior: current Gemini quiz, cram, mock exam, credits, dashboard,
  and leaderboard behavior must be replaced carefully; generated historical
  quiz/mock-exam data does not need to be migrated.
- Weak proof: no current test runner or RAG evaluation suite exists.
- Multi-domain: ingestion, retrieval, generation, billing, UI, storage,
  backend deployment, and observability all change.

## Product Contracts

- `docs/product/lean-rag-mvp.md`
- `docs/product/ai-provider-strategy.md`
- `docs/product/rag-clean-cutover.md`
- `docs/product/rag-data-model.md`

## Candidate Epics

| Epic | Description | Lane | Status |
| --- | --- | --- | --- |
| E02.1 | Product contract, architecture decision, and implementation boundaries | high-risk | planned |
| E02.2 | Monorepo split into `apps/web` and `apps/ai` | high-risk | planned |
| E02.3 | Supabase storage, document corpus schema, RLS, and clean data cutover | high-risk | planned |
| E02.4 | AI job queue contract and Python backend runner | high-risk | planned |
| E02.5 | PDF upload, validation, Docling extraction, chunking, and indexing | high-risk | planned |
| E02.6 | Embedding provider abstraction, OpenAI embeddings, and pgvector retrieval | high-risk | planned |
| E02.7 | LLM provider abstraction with OpenAI primary and Gemini fallback | high-risk | planned |
| E02.8 | RAG-backed regular quiz generation and cited quiz taking | high-risk | planned |
| E02.9 | RAG-backed cram mode generation with source citations | high-risk | planned |
| E02.10 | Study review generation from attempts and retrieved source evidence | high-risk | planned |
| E02.11 | Credit transaction ledger, spend/refund logic, and Stripe compatibility | high-risk | planned |
| E02.12 | RAG-backed mock exam generation, citations, and grading after the core RAG path | high-risk | planned |
| E02.13 | Evaluation, observability, provider benchmarking, and release proof | high-risk | planned |

## Harness Story Rows

The durable Harness matrix is the source of task status. Story packets should be
created from the high-risk story template when a row is selected for
implementation.

| Story | Title |
| --- | --- |
| US-RAG-001 | Lean RAG product contract and architecture decision |
| US-RAG-002 | Supabase document corpus, storage, pgvector, and RLS |
| US-RAG-003 | AI jobs table, claim protocol, and Python runner contract |
| US-RAG-004 | PDF upload and document processing status UX |
| US-RAG-005 | Docling extraction, page persistence, chunking, and validation |
| US-RAG-006 | Embedding providers, OpenAI vector index, and retrieval RPC |
| US-RAG-007 | LLM providers, structured JSON validation, and Gemini fallback |
| US-RAG-008 | RAG regular quiz generation and cited quiz-taking migration |
| US-RAG-009 | RAG cram mode generation and cited rapid-review UI |
| US-RAG-010 | Study review generation from attempts and source evidence |
| US-RAG-011 | Credit transaction ledger with spend/refund semantics |
| US-RAG-012 | RAG mock exam generation, citations, essays, and grading migration |
| US-RAG-013 | RAG evaluation suite, fixtures, logging, and provider benchmarks |
| US-RAG-014 | Split repository into `apps/web` and `apps/ai` |
| US-RAG-015 | Clean RAG data cutover and legacy generated-data retirement |

## Accepted Decisions

- Split the repo into `apps/web` and `apps/ai`.
- Use a clean cutover with no historical `quizzes` / `mock_exams` data
  migration.
- Develop Mock Exam immediately after regular quiz, cram mode, study review,
  and the shared job/credit/RAG substrate.

## Open Decisions

- Whether Gemini embeddings are enabled for development from the first pass or
  deferred until OpenAI embedding retrieval works end to end.
- Whether generated source excerpts are stored verbatim on questions or derived
  from chunk IDs at render time.

## Validation Shape

| Layer | Expected proof |
| --- | --- |
| Unit | Chunking, provider fallback classification, schema validation, credit spend/refund rules. |
| Integration | Supabase RLS, storage upload, job claiming, retrieval RPC, provider mocks, Stripe idempotency. |
| E2E | Upload PDF -> ready document -> regular quiz -> attempt -> study review; upload -> cram; upload -> mock exam. |
| Platform | Next.js build, Python backend health/job endpoints, deployment env checks. |
| Evaluation | JSON validity, citation validity, duplicate rate, latency, cost, hallucination checks on a fixed PDF set. |

## Harness Delta

- Harness CLI was installed into `scripts/bin/harness-cli`.
- Intake recorded for the Lean RAG MVP as high-risk.
- Durable story rows US-RAG-001 through US-RAG-015 were added.
