# 0014 RAG evaluation gate: deterministic metrics over raw output

Date: 2026-06-30

## Status

Accepted

## Context

`ai-provider-strategy.md` defines "Evaluation Gates" with a minimum release bar
(JSON validity ≥95%, citation validity ≥95%, duplicate-question rate ≤10%,
grounded explanations, no unsupported claims), but nothing computes those rates,
so the bar cannot be checked and provider quality regressions go unmeasured
(US-RAG-013). Building the gate forced three choices: *what* to score, *which*
metrics to enforce, and *how* to keep it both CI-reproducible and useful as a live
provider benchmark.

## Decision

- **Score the provider's raw generation output, not the persisted rows.** The
  generation handlers already drop dangling/malformed items at persist time
  (US-RAG-008+), so persisted `questions` are ~100% valid by construction. The
  gate scores `result.data` straight from the generation service, which is what
  actually measures provider quality.
- **Deterministic metrics only; gate on the three documented hard rates.** A pure
  `app/eval/metrics.py` scores structural/JSON validity, citation validity (every
  `source_chunk` resolves to a provided chunk), duplicate rate (normalized prompt
  repeats), and a content-word-overlap **grounding proxy**. The gate
  (`app/eval/gate.py`) enforces `RELEASE_BAR` = {json_validity ≥ 0.95,
  citation_validity ≥ 0.95, duplicate_rate ≤ 0.10}; grounding is **reported, not
  gated** (it is a proxy). The thresholds live in one place and mirror the product
  doc verbatim.
- **Separate the pure library from the live call.** Metrics + gate are pure and
  unit-tested; the live provider call lives only in the `eval_gate.py` CLI, which
  also supports an offline-from-file mode so the gate can run with no network.
- **No LLM-judge, no cost/latency gate this story.** Judge-based quality /
  hallucination scoring (non-deterministic, needs a second model) and a latency
  budget are deferred; latency is reported by the benchmark but not gated.

## Alternatives Considered

1. **Score persisted `questions`** — measures nothing (handlers already dropped
   the bad items). Rejected.
2. **LLM-judge metrics for quality/hallucination** — non-deterministic, costly,
   hard to unit-test; deferred to a later extension. The citation + grounding
   proxies cover the documented hard gates.
3. **A live-only gate** — would leave the eval code itself untested; rejected in
   favor of a pure library + an isolated CLI with an offline mode.

## Consequences

Positive:

- The documented release bar becomes a runnable, reproducible check; provider
  regressions (dangling citations, duplicates, malformed output) are caught.
- The pure metric library is unit-tested and stable; the live benchmark reuses
  the existing generation/repair/fallback service with no new infrastructure.
- The gate persists nothing and spends no credits — safe to run anytime.

Tradeoffs:

- The grounding metric is a lexical-overlap proxy, not a semantic/entailment
  check — reported, not gated, to avoid false confidence.
- Question/explanation *quality* and hallucination beyond citation/grounding are
  not yet measured (no judge model).
- The fixture set is small and hand-authored (a "fixed set" analog), not a large
  golden corpus; widening it is future work.

## Follow-Up

- Add an LLM-judge metric (quality, hallucination) as an optional, separately
  gated extension.
- Wire `eval_gate.py --offline` into CI over captured outputs; define a latency
  budget if/when one is agreed.
- Grow the fixture corpus toward the "fixed PDF set" the strategy describes.
