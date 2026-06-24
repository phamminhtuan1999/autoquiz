# Design

## Domain Model

- **LlmProvider** (Protocol): `name`, `model`, and
  `generate_json(prompt, *, schema, system=None) -> dict`. Returns a parsed JSON
  object. Raises `LlmError(retryable: bool)` on failure.
- **OpenAIChatProvider** (`name="openai"`): POST `/chat/completions` with
  `response_format={"type": "json_object"}`; model from settings
  (`gpt-4o-mini` default).
- **GeminiChatProvider** (`name="gemini"`): POST
  `…/models/<model>:generateContent` with
  `generationConfig.responseMimeType="application/json"`; model from settings
  (`gemini-2.0-flash` default).
- **GenerationService**: holds `primary` + optional `fallback` provider and a
  `JsonValidator`; owns the repair-then-fallback orchestration.
- **LlmError**: carries `retryable: bool` and the originating provider/category
  so the caller (a job handler, later) can decide spend/refund and retry.

## Application Flow

`GenerationService.generate(prompt, schema, system=None) -> GenerationResult`:

1. Call `primary.generate_json(...)`.
2. Validate the object against `schema` (cheap structural validator — required
   keys, types, enum/range where given).
3. On a **retryable** provider error **or** a JSON/schema-validation failure:
   retry the *same* provider **once** with an appended repair instruction that
   includes the validation error and the exact schema.
4. If the repaired attempt still fails with a retryable error and a `fallback`
   provider exists: run steps 1–3 against the fallback.
5. Return `GenerationResult(data, provider_name, model, repaired: bool,
   fell_back: bool)` on success.
6. If all paths are exhausted, raise the final `LlmError` with its
   retryable flag intact. A **non-retryable** error short-circuits immediately —
   no repair, no fallback.

Error classification (`classify_http_status` + message heuristics):
retryable = {408 timeout, 429 rate limit, 500/502/503/504 outage, model
unavailable, invalid JSON after one repair}; non-retryable = {401/403 permission,
402 insufficient credits, 400 invalid input, unsafe/blocked content}.

## Interface Contract

- `build_llm_provider(settings, role) -> LlmProvider` (role = "primary" |
  "fallback") selects by `settings.generation_provider` /
  `generation_fallback_provider`.
- `build_generation_service(settings) -> GenerationService` wires primary +
  fallback from settings.
- `generate_json(prompt, *, schema, system=None) -> dict` is the provider-level
  call; `GenerationService.generate(...)` is the orchestrated entry the rest of
  `apps/ai` uses.

## Data Model

None. No tables, migrations, or storage. Pure compute over provider HTTP APIs.

## UI / Platform Impact

`apps/ai` only. New settings: `generation_provider` (default `openai`),
`generation_fallback_provider` (default `gemini`), `openai_chat_model`,
`gemini_chat_model`. Keys reuse the existing `openai_api_key` / `gemini_api_key`.
No web/UI change. No new dependency (stdlib `urllib` + `json`).

## Observability

`GenerationResult` exposes `provider_name`, `model`, `repaired`, `fell_back` so
the calling job (US-RAG-008) can log which provider/model served a generation
and whether a repair or fallback was needed. `LlmError.category` names the
failure for job-level audit.

## Alternatives Considered

1. **Use the OpenAI / google-genai SDKs.** Rejected: the rest of `apps/ai` is
   deliberately SDK-free `urllib` (see `embeddings.py`); adding heavy SDKs splits
   the style and the dependency surface for no gain at this scope.
2. **Full JSON Schema validator (e.g. `jsonschema`).** Rejected for this story:
   a small structural validator (required/type/enum/range) covers the product
   schemas we will define in 008+ and adds no dependency; can be swapped later if
   schemas grow complex.
3. **Provider-native structured output (OpenAI `json_schema` /
   Gemini `responseSchema`).** Used as a hint where cheap, but we still validate
   locally and own the repair loop, because the fallback provider must satisfy
   the *same* contract regardless of its native capabilities.
