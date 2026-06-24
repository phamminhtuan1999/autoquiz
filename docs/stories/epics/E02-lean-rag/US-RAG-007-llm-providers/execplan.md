# Exec Plan

## Goal

A provider-agnostic, JSON-validated generation layer in `apps/ai` that
US-RAG-008+ can call to turn a prompt + schema into a validated object, with one
repair attempt and primary→fallback orchestration, and explicit retryable vs
non-retryable failure classification.

## Scope

In scope:

- `LlmProvider` seam + `OpenAIChatProvider` + `GeminiChatProvider` (SDK-free).
- `JsonValidator` (structural: required keys, types, enum, numeric range).
- `GenerationService` repair-then-fallback orchestration + `GenerationResult`.
- `LlmError(retryable, category, provider)` + HTTP-status classification.
- Settings: `generation_provider`, `generation_fallback_provider`,
  `openai_chat_model`, `gemini_chat_model`.
- Unit tests (fakes) + one live-Gemini E2E.

Out of scope:

- Product schemas / prompts for quiz/cram/review/mock (US-RAG-008+).
- Wiring into an `ai_jobs` handler or web route.
- Citation-validity enforcement, streaming, token/cost metering.
- OpenAI live verification (no key in env — fake-tested + documented run).

## Risk Classification

Risk flags:

- External systems (OpenAI, Gemini HTTP APIs).
- Public contracts (the generation contract 008+ depend on).
- Weak proof (no prior generation tests; mitigated by seam + unit + live E2E).

Hard gates:

- External provider behavior → covered by the live-Gemini E2E + fake-provider
  unit tests; no schema/auth/data-loss gate touched (no DB, no migration).

## Work Phases

1. Discovery — read `ai-provider-strategy.md`, `embeddings.py` HTTP pattern,
   job error-handling conventions. (done)
2. Design — seam, orchestration, classification (this packet). (done)
3. Validation planning — see `validation.md`.
4. Implementation — `app/llm.py`, settings, tests.
5. Verification — unit suite green; live-Gemini E2E generates a schema-valid
   object; fallback + repair + classification proven by unit tests.
6. Harness update — `story add US-RAG-007`, record trace, update matrix.

## Stop Conditions

Pause for human confirmation if:

- A product schema or prompt would have to be invented here (belongs in 008).
- The provider contract would need to weaken (e.g. drop local validation,
  expose keys client-side, mix embedding spaces).
- Fallback/credit semantics turn out to need a durable decision record beyond
  what `ai-provider-strategy.md` already fixes.
