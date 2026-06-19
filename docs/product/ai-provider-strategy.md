# AI Provider Strategy

## Production MVP

| Capability | Primary | Fallback / Dev |
| --- | --- | --- |
| Generation | OpenAI | Gemini |
| Embeddings | OpenAI `text-embedding-3-small` | Gemini embedding for development or full-document fallback |
| Vector search | Supabase pgvector | None |

## Rules

- API keys must never be exposed to the browser.
- Generation providers can fallback by request when the error is retryable.
- Embedding providers must not be mixed in one vector search space.
- A document index uses one embedding provider/model for all chunks.
- Retrieval must embed the query with the same provider/model used to index the
  document.
- Every generated question or review item that claims a source must cite a
  source chunk provided in the retrieval context.

## Retryable Generation Failures

- Timeout.
- Rate limit.
- Provider outage.
- Model unavailable.
- Invalid JSON after one repair attempt.

## Non-Retryable Failures

- Insufficient credits.
- Unsupported document.
- Unsafe request.
- User permission failure.
- Invalid application input.

## Evaluation Gates

Before a provider becomes part of a release path, test it against the same fixed
PDF set for:

- JSON validity.
- Citation validity.
- Question quality.
- Explanation quality.
- Duplicate question rate.
- Latency.
- Cost.
- Failure rate.
- Hallucination rate.

Minimum release bar:

- JSON validity at least 95%.
- Citation validity at least 95%.
- Duplicate question rate no more than 10%.
- Explanations grounded in retrieved chunks.
- No unsupported claims outside retrieved context.
