# Overview

## Current Behavior

The four RAG generation modes (regular, cram, study_review, mock) are shipped and
live in the UI. Each handler enforces grounding *defensively at persist time* — it
drops any model item with a dangling citation or a malformed shape (US-RAG-008+).
But there is **no measurement** of how good a provider's raw output actually is,
and **no release bar** to gate a provider on. `ai-provider-strategy.md` defines an
"Evaluation Gates" section (JSON validity ≥95%, citation validity ≥95%, duplicate
question rate ≤10%, grounded explanations, no unsupported claims) — but nothing
computes those rates, so the bar cannot be checked. The initiative explicitly
flags this gap: *"no current test runner or RAG evaluation suite exists."*

## Target Behavior

A self-contained **evaluation gate** for RAG generation, in `apps/ai`:

- A **metric library** that scores a provider's *raw* generation output (before
  the handler's defensive dropping) against the strategy's criteria: structural /
  JSON validity, citation validity (every cited chunk is in the provided
  context), duplicate-question rate, and a lightweight grounding proxy.
- A **release-bar gate** that aggregates the metrics across a set of fixture
  cases and returns pass/fail against the documented thresholds, naming any
  threshold that was missed.
- A small set of **fixture cases** (grounded chunk sets) — the "fixed PDF set"
  analog — that the gate runs against.
- A **CLI** (`eval_gate.py`) that runs the gate either as a **live provider
  benchmark** (generate against the fixtures via the existing US-RAG-007 service,
  score, report rates + latency + the gate decision, exit non-zero on failure) or
  **offline** against a recorded outputs file (no network).

The gate measures provider quality; it does not change any generation behavior.

## Affected Users

- Maintainer / release owner — can benchmark a generation provider/model against
  a fixed bar before putting it on a release path, and catch quality regressions
  (dangling citations, duplicates, malformed output) that the defensive handlers
  would otherwise silently absorb.

## Affected Product Docs

- `docs/product/ai-provider-strategy.md` (the "Evaluation Gates" + release bar
  this story implements)
- `docs/product/lean-rag-mvp.md` (grounded, cited generation the gate measures)

## Non-Goals

- LLM-judge metrics requiring a second model (question/explanation *quality*,
  hallucination scoring beyond citation/grounding) — the gate uses deterministic,
  reproducible metrics; judge-based scoring is a later extension.
- Cost accounting and a latency budget — latency is reported by the live
  benchmark but not gated (no fixed budget is defined yet).
- Wiring the gate into CI or a provider-selection flow — this story delivers the
  runnable gate + library; CI wiring is a separate ops step.
- Embedding/retrieval evaluation — this story scores generation output.
