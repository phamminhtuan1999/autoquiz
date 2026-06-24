# Overview

## Current Behavior

US-RAG-005's `process_document` worker extracts pages + chunks and marks the
document `ready`, but no embeddings are produced: `chunk_embeddings_openai` /
`chunk_embeddings_gemini` stay empty and `documents.embedding_provider` /
`embedding_model` stay null. The `match_document_chunks_*` retrieval RPCs and
the OpenAI vector index already exist (US-RAG-002) but have nothing to search.

## Target Behavior

The worker indexes each document for semantic retrieval:

- After chunks persist, embed every chunk's text with the configured provider
  and write `chunk_embeddings_<provider>` rows (one provider/model per
  document).
- Record `documents.embedding_provider` + `embedding_model`, then mark `ready`
  (the `ready` flip moves from "after chunks" to "after embeddings").
- A retrieval helper embeds a query with the **same** provider/model and calls
  `match_document_chunks_<provider>` to return cited chunks for generation
  (US-RAG-008).

Providers follow `docs/product/ai-provider-strategy.md`: OpenAI
`text-embedding-3-small` (1536) is the production primary; Gemini
`gemini-embedding-001` (3072) is the development / fallback provider. One
document's index uses a single provider/model space; queries embed with the
same one.

## Affected Users

- Student (document owner) — uploaded documents become semantically searchable,
  enabling source-grounded generation next.

## Affected Product Docs

- `docs/product/ai-provider-strategy.md` (provider roles, one-space rule)
- `docs/product/rag-data-model.md` (embedding tables, retrieval RPCs)
- `docs/product/lean-rag-mvp.md` (Core Flow step 5)

## Non-Goals

- Generation of quizzes/cram/review/mock (US-RAG-008+).
- Reranking or hybrid (keyword+vector) retrieval.
- Tuning/creating the vector index (already exists from US-RAG-002).
- Web/UI changes.
- An ANN index for the 3072-dim Gemini table (exact search; see schema note).
