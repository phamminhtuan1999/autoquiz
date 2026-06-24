# Exec Plan

## Goal

Index each processed document for semantic retrieval: embed chunks with the
configured provider, persist provider-specific vectors, and provide a
same-space query retrieval helper for generation (US-RAG-008).

## Scope

In scope:

- `EmbeddingProvider` seam + OpenAI (primary) and Gemini (dev/fallback) HTTP
  implementations; configurable active provider.
- Integrate embedding into `process_document` before the `ready` flip; record
  `documents.embedding_provider/_model`.
- `DocumentStore.save_embeddings` (chunk_index→chunk_id resolution, idempotent
  upsert) + `mark_ready` embedding fields.
- `Retriever`: embed query + call `match_document_chunks_<provider>`.
- Unit tests (fake provider) + a real-provider E2E.

Out of scope:

- Generation (US-RAG-008+), reranking/hybrid retrieval, index tuning, web
  changes, OCR.

## Risk Classification

Risk flags:

- External systems: OpenAI / Gemini embedding APIs.
- Data model: writes to embedding tables; document index metadata.
- Authorization: service-role writes set correct `user_id`.
- Audit/security: provider API keys never reach the browser (server-only).
- Existing behavior: changes where `process_document` marks `ready`.

Hard gates:

- External provider behavior (handled: provider seam + fake-provider unit
  tests; real run via the available Gemini key; OpenAI primary documented
  manual run).

## Work Phases

1. Discovery — schema/RPCs, provider keys, 005 handler (done).
2. Design — this packet.
3. Validation planning — `validation.md`.
4. Implementation — providers, config, store, handler, retriever.
5. Verification — unit tests; real-Gemini embed→persist→retrieve E2E on a live
   queued job; OpenAI primary documented as a manual run.
6. Harness update — story add/update, trace.

## Stop Conditions

Pause for human confirmation if:

- A provider/model would change the embedding dimension vs. its table.
- Mixing providers in one document's index becomes necessary.
- Keys would need to be exposed outside `apps/ai`.
- A schema change becomes necessary.
