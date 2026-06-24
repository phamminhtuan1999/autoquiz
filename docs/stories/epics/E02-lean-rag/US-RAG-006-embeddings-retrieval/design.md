# Design

## Domain Model

- **EmbeddingProvider** — `name` (`openai`/`gemini`), `model`, `dimension`,
  `target_table` (`chunk_embeddings_openai`/`chunk_embeddings_gemini`),
  `embed(texts) -> vectors`, `embed_query(text) -> vector`.
- A document's index is single-space: all chunk embeddings use one
  provider+model, recorded on `documents`. Retrieval must embed the query with
  that same provider+model (provider-strategy rule).

## Application Flow

`process_document` (extended): … extract → save_pages → save_chunks →
**embed chunks** → save_embeddings → mark_ready (now with
`embedding_provider`/`embedding_model`). Embedding sits inside the existing
try-block, so provider failures are transient (runner retries; final attempt
marks the document `failed`). Empty chunk set ⇒ no embeddings, still `ready`.

Retrieval (`Retriever.retrieve`): `embed_query(q)` →
`rpc(match_document_chunks_<provider>, {query_embedding, match_count,
p_document_id, p_user_id})` → cited chunks (`chunk_id, content, page_start,
page_end, similarity`).

## Interface Contract

Providers (HTTP, SDK-free like the rest of `apps/ai`):

- OpenAI: `POST https://api.openai.com/v1/embeddings`
  `{model, input: [...]}` → `data[i].embedding`. Bearer `openai_api_key`.
- Gemini: `POST .../v1beta/models/{model}:batchEmbedContents?key=…`
  `{requests:[{model, content:{parts:[{text}]}, outputDimensionality:3072}]}`
  → `embeddings[i].values`.

`DocumentStore` gains:

- `save_embeddings(document_id, user_id, *, provider, model, target_table,
  embeddings_by_index)` — resolves `chunk_index → chunk_id` from
  `document_chunks`, then upserts rows `(user_id, chunk_id, provider, model,
  embedding)` on conflict `(chunk_id, provider, model)`.
- `mark_ready(..., *, embedding_provider=None, embedding_model=None)`.

Vectors are serialized to the pgvector text literal `"[v0,v1,…]"` for both
inserts and the RPC `query_embedding` parameter.

## Data Model

No schema change. Writes: `chunk_embeddings_openai` (1536) /
`chunk_embeddings_gemini` (3072), and `documents.embedding_provider/_model`.
Upserts keyed on `(chunk_id, provider, model)` keep re-runs idempotent.

## UI / Platform Impact

`apps/ai` only: new `app/embeddings.py`, `app/retrieval.py`; extends
`app/jobs/process_document.py`, `app/supabase_io.py`, `app/config.py`. No new
dependency (raw HTTP). No web changes.

## Observability

Progress gains an `embedding` step; job `output` adds `embeddings` count;
`documents.embedding_provider/_model` record the index space.

## Alternatives Considered

1. **Add `openai` / `google-generativeai` SDKs.** Rejected: kept the SDK-free
   HTTP pattern (consistency, minimal deps).
2. **Generate chunk UUIDs client-side to link embeddings.** Rejected: resolving
   `chunk_index → chunk_id` from the just-written rows keeps `save_chunks`
   unchanged and survives upsert re-runs.
3. **Default to Gemini because OpenAI has no key here.** Rejected: default stays
   OpenAI (production primary); the active provider is configurable, and the
   real E2E runs via Gemini (the available key) per the agreed verification.
