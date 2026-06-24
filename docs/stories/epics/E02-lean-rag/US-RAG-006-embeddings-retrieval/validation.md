# Validation

## Proof Strategy

The provider sits behind an `EmbeddingProvider` seam, so the handler/store
orchestration is proven deterministically with a fake provider, and the real
embed→persist→retrieve path is proven against live Supabase + a live embedding
API using the available Gemini key. OpenAI (production primary) is proven by
fake-provider tests + a documented manual run once a key is available.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Handler embeds chunks and calls `save_embeddings` before `mark_ready` (step order: processing→pages→chunks→embeddings→ready); `mark_ready` carries provider/model; empty chunks → ready with 0 embeddings; embedding-provider failure → transient (re-raise; final attempt → failed). Provider factory selects openai/gemini by config. pgvector serialization `[...]`. |
| Integration | `save_embeddings` resolves chunk_index→chunk_id and upserts to the right table; `Retriever` calls the right RPC name. |
| E2E | Live Supabase + live Gemini: real worker (Gemini embedder, fake extractor) processes a queued job → `chunk_embeddings_gemini` rows written, `documents.embedding_provider='gemini'`, `ready`; `Retriever.retrieve` embeds a query and `match_document_chunks_gemini` returns the chunk. |
| Platform | `apps/ai` unit tests pass; modules import without provider keys set. |
| Logs/Audit | Job `output.embeddings` count; `documents.embedding_provider/_model` recorded. |

## Fixtures

- Live Gemini key (`AUTOQUIZ_AI_GEMINI_API_KEY` = repo `GEMINI_API_KEY`).
- A queued `process_document` job + storage object (created in the E2E).
- `FakeEmbeddingProvider` returning deterministic vectors for unit + handler E2E.

## Commands

```text
cd apps/ai && PYTHONPATH=. python -m unittest discover -s tests
# E2E: real Gemini embedder + real Supabase IO on a controlled queued job
```

## Acceptance Evidence

Verified 2026-06-23.

- **Unit**: `python -m unittest discover -s tests` → 17 tests pass (4 runner +
  8 handler + 5 embeddings). Handler now embeds before `ready`
  (steps: processing→pages→chunks→embeddings→ready), `mark_ready` carries
  provider/model, embedding-provider failure is transient (final attempt →
  `failed`, never `ready`); provider factory selects openai/gemini and rejects
  unknown; `to_pgvector` literal; empty input makes no HTTP call. Modules import
  without provider keys.
- **E2E (live Supabase + live Gemini)**: real worker (Gemini embedder, fake
  extractor) processed a queued job → document `ready`,
  `embedding_provider='gemini'`, `embedding_model='gemini-embedding-001'`, 1 row
  in `chunk_embeddings_gemini`, job `succeeded` output
  `{pages:1, chunks:1, embeddings:1, result:"ready"}`. `Retriever.retrieve`
  embedded a query via Gemini and `match_document_chunks_gemini` returned the
  chunk with cosine **similarity 0.796** — proving the pgvector serialization
  for both the insert and the RPC parameter. Fixture torn down.
- **Deferred (agreed)**: OpenAI primary (`text-embedding-3-small`, 1536) —
  fake-provider unit tests + a documented manual run once an OpenAI key is
  added (`AUTOQUIZ_AI_OPENAI_API_KEY`, `AUTOQUIZ_AI_EMBEDDING_PROVIDER=openai`).
