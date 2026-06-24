# Overview

## Current Behavior

US-RAG-006 made documents semantically searchable: the worker embeds chunks and
a `Retriever` returns cited source chunks for a query. But nothing yet turns
those chunks into generated content — there is no LLM provider in `apps/ai`, no
structured-JSON contract, and no fallback path. Generation cannot start.

## Target Behavior

A provider-agnostic generation layer that downstream stories (US-RAG-008 quiz,
009 cram, 010 review, 012 mock exam) call to produce **schema-validated JSON**
from a prompt:

- An `LlmProvider` seam with two implementations — OpenAI (production primary)
  and Gemini (fallback / development) — both SDK-free HTTP, both returning a
  parsed JSON object validated against a caller-supplied JSON Schema.
- A `GenerationService` that orchestrates: call primary → validate JSON → on a
  **retryable** failure, retry once with a repair instruction → on continued
  retryable failure, **fall back** to the secondary provider → classify the
  final error as retryable or non-retryable for the caller.
- Failure classification follows `ai-provider-strategy.md`: timeout, rate limit,
  outage, model-unavailable, and invalid-JSON-after-one-repair are retryable;
  insufficient credits, unsupported document, unsafe request, permission
  failure, and invalid input are non-retryable.

API keys stay server-side (`apps/ai` only); they are never exposed to the
browser.

## Affected Users

- Student (document owner) — indirectly: this is the substrate that lets their
  uploaded, indexed documents become grounded quizzes/cram/review next.

## Affected Product Docs

- `docs/product/ai-provider-strategy.md` (primary/fallback, retryable rules,
  JSON repair, never expose keys)
- `docs/product/lean-rag-mvp.md` (Core Flow generation step)

## Non-Goals

- Quiz / cram / review / mock-exam schemas and generation prompts
  (US-RAG-008+). This story validates JSON against a caller-supplied schema; it
  does not define product schemas.
- Wiring generation into any `ai_jobs` handler or web route.
- Citation-validity enforcement (the generation stories own "every claim cites a
  retrieved chunk").
- Streaming responses, token accounting, and cost metering (US-RAG-013).
- OpenAI live verification (deferred: no key in this environment).
