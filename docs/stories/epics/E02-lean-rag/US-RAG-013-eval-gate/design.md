# Design

## Domain Model

The gate scores **raw generation items** — the model's output before the
handlers' defensive mapping drops anything. An MCQ item is the schema shape the
generators already use: `{prompt, options[4], answer_index, source_chunk (1-based),
explanation, topic?, difficulty?}`. A **case** pairs a list of `SourceChunk`
(the grounding context) with the raw items generated from it.

- **`MetricCounts`** (per case, then aggregated) — `total`, `structural_valid`,
  `citation_valid`, `duplicates`, `grounded`, with derived rates:
  `json_validity = structural_valid/total`, `citation_validity =
  citation_valid/total`, `duplicate_rate = duplicates/total`, `grounding_rate =
  grounded/total`.
- **`RELEASE_BAR`** — the documented thresholds (`json_validity ≥ 0.95`,
  `citation_validity ≥ 0.95`, `duplicate_rate ≤ 0.10`). Grounding is reported, not
  gated (it is a proxy; the hard gates are the three documented rates).
- **`GateResult`** — aggregate counts/rates, `passed: bool`, and `failures:
  [str]` naming each missed threshold; plus `cases`, `items`, and (live)
  `provider`/`model`/`latency`.

## Application Flow

1. **Metric scoring** (`app/eval/metrics.py`, pure) — per item: structurally
   valid? (prompt non-empty; exactly 4 non-empty options; `answer_index` ∈ 0..3);
   citation valid? (`source_chunk` ∈ 1..len(chunks)); duplicate? (its normalized
   prompt equals an earlier item's in the same case); grounded? (content-word
   overlap between the correct option + explanation and the cited chunk ≥ a floor,
   only when the citation resolves). `score_case(items, chunks) -> MetricCounts`.
2. **Gate** (`app/eval/gate.py`) — `run_gate(cases) -> GateResult` aggregates
   counts across cases, computes rates, and compares to `RELEASE_BAR`.
3. **Fixtures** (`app/eval/fixtures.py`) — a few self-contained grounded chunk
   sets + a generation spec (num questions) per case; the live benchmark's "fixed
   set".
4. **CLI** (`eval_gate.py`) —
   - *live* (default): for each fixture case, call the US-RAG-007 generation
     service with `quiz_schema`/`build_prompt`, collect `result.data["questions"]`,
     time it, score, aggregate, print a JSON report, exit `0` iff `passed`.
   - *offline* (`--offline <file>`): score a recorded cases file (raw items +
     chunk text) — no network, for reproducible/CI runs.

## Interface Contract

- `score_case(items: list[dict], chunks: list[SourceChunk]) -> MetricCounts`
- `aggregate(counts: list[MetricCounts]) -> MetricCounts`
- `run_gate(cases: list[tuple[list[dict], list[SourceChunk]]]) -> GateResult`
- `RELEASE_BAR: dict[str, float]` — the single source of the thresholds.
- CLI: `python eval_gate.py [--offline FILE] [--num N]` → prints a JSON report,
  exit `0` pass / `1` fail / `2` error. No HTTP/API surface; internal tooling.

## Data Model

None. The gate reads the generation service and in-memory fixtures; it persists
nothing and touches no table.

## UI / Platform Impact

`apps/ai` only: a new `app/eval/` package, an `eval_gate.py` entrypoint, and unit
tests. No web, no schema, no new runtime dependency (stdlib + the existing
generation service).

## Observability

The CLI emits a structured JSON report: per-case and aggregate rates, the
pass/fail decision with named threshold failures, and (live)
provider/model/per-case latency. This is the "logging / provider benchmark"
the story calls for.

## Alternatives Considered

1. **Score the persisted `questions` instead of raw model output.** Rejected: the
   handlers already drop dangling/malformed items at persist time, so persisted
   data is ~100% valid by construction and measures nothing. The gate must see the
   *raw* output to measure provider quality.
2. **LLM-judge for quality/hallucination.** Deferred: non-deterministic, needs a
   second model + cost, and is hard to unit-test. The deterministic citation +
   grounding-overlap proxies cover the documented hard gates; judge metrics are a
   later extension.
3. **A live-only gate.** Rejected: the metric/gate logic must be unit-tested
   deterministically (the eval code is itself code that can regress), so the
   library is pure and the live provider call is an isolated CLI concern with an
   offline-from-file alternative.
4. **Gate on latency/cost.** Deferred: reported by the live benchmark but not
   gated — no fixed budget is defined in the strategy doc yet.
