# Validation

## Proof Strategy

The orchestration (repair, fallback, classification) sits behind an
`LlmProvider` seam, so it is proven deterministically with fake providers that
raise scripted errors / return scripted JSON. The real HTTP path is proven
against live Gemini using the available key. OpenAI (production primary) is
proven by fake-provider tests + a documented manual run once a key is available.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `JsonValidator`: accepts valid; rejects missing key / wrong type / bad enum / out-of-range. `GenerationService`: primary success (no repair, no fallback); invalid-JSON → one repair → success (`repaired=True`); retryable primary error → fallback provider success (`fell_back=True`); non-retryable primary error → raises immediately, **no** repair, **no** fallback; both providers fail retryably → raises `LlmError(retryable=True)`; repair attempted at most once per provider. Classification: 429/500/503/timeout → retryable; 400/401/402/403/unsafe → non-retryable. Provider factory selects openai/gemini and rejects unknown; keys never logged. |
| Integration | Provider `generate_json` parses real OpenAI/Gemini response envelopes (mocked HTTP) into a dict; repair prompt carries the schema + validation error. |
| E2E | Live Gemini: `GenerationService` (Gemini primary) generates an object for a small caller schema (e.g. `{question, options[4], answer_index}`), the result validates, `provider_name="gemini"`. A forced-invalid schema demonstrates the repair path against the live model. |
| Platform | `apps/ai` unit suite passes; `app/llm.py` imports without any provider key set. |
| Logs/Audit | `GenerationResult` reports `provider_name`, `model`, `repaired`, `fell_back`; `LlmError` reports `category` + `retryable`. |

## Fixtures

- `FakeLlmProvider` — scripted to return a given object, raise `LlmError`
  (retryable/non-retryable), or return malformed JSON on the first call then a
  valid object on repair.
- Live Gemini key (`AUTOQUIZ_AI_GEMINI_API_KEY` = repo `GEMINI_API_KEY`).
- A small deterministic caller schema used by both unit and E2E.

## Commands

```text
cd apps/ai && PYTHONPATH=. python -m unittest discover -s tests
# E2E: real Gemini generation behind GenerationService on a small schema
```

## Acceptance Evidence

Verified 2026-06-24.

- **Unit**: `python3 -m unittest discover -s tests` → **37 tests pass** (4 runner
  + 8 process_document + 5 embeddings + **20 llm**). The llm tests prove:
  `validate_json` accepts valid and rejects missing-key / wrong-type /
  bool-as-integer / bad-enum / out-of-range / wrong-item-count; classification
  (429/5xx/timeout retryable, 4xx non-retryable); and `GenerationService`
  orchestration — primary success (no repair, no fallback); invalid JSON → one
  repair → success (`repaired=True`); retryable error → fallback
  (`fell_back=True`, no wasted repair); non-retryable → raises immediately with
  **no** fallback; invalid-after-repair → fallback; both fail → raises
  `LlmError(retryable=True)`; repair attempted at most once per provider. Factory
  selects openai/gemini, supports a single-provider (`fallback=none`) config, and
  rejects unknown. Providers construct with empty keys (import-safe).
- **E2E (live Gemini)**: `GenerationService` with Gemini primary
  (`gemini-2.5-flash`) generated a grounded MCQ against the caller schema
  `{question, options[4], answer_index 0–3, difficulty enum}` — result validated
  with **0 schema errors**, `provider_name="gemini"`. The live model's first
  response failed validation and the **one-shot repair recovered it**
  (`repaired=True`), exercising the real repair loop end to end, not just the
  fakes.
- **Config finding**: `gemini-2.0-flash` returns `limit: 0` (no free-tier
  generateContent quota) on the available key; default `gemini_chat_model`
  changed to `gemini-2.5-flash`, which is verified working for the dev/fallback
  path.
- **Deferred (agreed)**: OpenAI primary (`gpt-4o-mini`) — fake-provider unit
  tests + a documented manual run once `AUTOQUIZ_AI_OPENAI_API_KEY` is set
  (`AUTOQUIZ_AI_GENERATION_PROVIDER=openai`).
