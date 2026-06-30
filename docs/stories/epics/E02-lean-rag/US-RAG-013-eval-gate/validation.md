# Validation

## Proof Strategy

The metric library and gate are pure, deterministic code, so they are proven by
unit tests against crafted fixtures (valid items, dangling citations, duplicates,
malformed shapes, grounded vs ungrounded) that assert the exact rates and the
gate's pass/fail decision against the release bar. The live provider-benchmark
CLI is proven by a smoke run against Gemini that produces a report and a gate
decision end to end. No existing test regresses.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `metrics`: structural validity (4 good options vs 3/blank/bad-index → drops), citation validity (in-range vs dangling), duplicate rate (normalized prompt repeats), grounding proxy (overlapping vs unrelated text), aggregation across cases. `gate`: a clean set passes; a set with <95% citations fails and names `citation_validity`; a set with >10% duplicates fails and names `duplicate_rate`; `RELEASE_BAR` matches `ai-provider-strategy.md`. |
| Integration | The CLI's offline mode scores a recorded cases file and exits 0/1 by the gate; the live mode wires the US-RAG-007 service + `quiz_schema`/`build_prompt`. |
| E2E | Live benchmark: `python eval_gate.py` against the fixtures via Gemini prints a JSON report (per-case + aggregate rates, provider/model/latency) and exits by the gate decision. |
| Platform | `apps/ai` unit suite stays green; no new dependency; the CLI runs under the SDK-free path. |
| Performance | The benchmark times each case; latency is reported, not gated. |
| Logs/Audit | The report is structured JSON; a failing gate names each missed threshold. The benchmark writes no data and spends no credits. |

## Fixtures

- In-memory fixture cases in `app/eval/fixtures.py` (grounded chunk sets +
  per-case question counts).
- Unit fixtures: hand-crafted raw item lists exercising each metric branch.
- Live benchmark: the existing `.env` mapped to `AUTOQUIZ_AI_*` with the Gemini
  generation path (no OpenAI key locally), via the scratchpad venv.

## Commands

```text
cd apps/ai/tests && PYTHONPATH=.. python3 -m unittest discover -p 'test_*.py'
# Live benchmark (dev): python eval_gate.py   (prints report, exits by gate)
```

## Acceptance Evidence

Verified 2026-06-30.

- **Unit**: `cd apps/ai/tests && PYTHONPATH=.. python3 -m unittest discover -p
  'test_*.py'` → **Ran 125 tests … OK** (96 prior + **29 new**: 20 in
  `test_eval_metrics` — structural validity incl. bool/blank/bad-index, citation
  validity, prompt normalization, grounding overlap vs unrelated vs dangling,
  `score_case` counts + rates, aggregation; 9 in `test_eval_gate` — `RELEASE_BAR`
  matches the strategy doc, clean set passes, dangling citations fail the citation
  gate, duplicates fail the duplicate gate, malformed fail the json gate, empty
  fails, multi-case aggregation, all-missed-thresholds named, `as_dict` shape).
- **CLI offline (deterministic, no network)**: `python eval_gate.py --offline
  <file>` — a clean cases file → `passed: true`, all rates 1.0, **exit 0**; a file
  with dangling citations + a duplicate → `passed: false`, failures `["citation_
  validity 0.000 < 0.95", "duplicate_rate 0.500 > 0.1"]`, **exit 1**.
- **CLI live benchmark (Gemini, scratchpad venv, `.env` → `AUTOQUIZ_AI_*`)**:
  `python eval_gate.py` generated against the 3 fixture cases (cell-biology,
  world-history, basic-physics) and scored the **raw** output. Aggregate
  `json_validity 1.0, citation_validity 1.0, duplicate_rate 0.0, grounding_rate
  1.0` over **11 items / 3 cases** → **`passed: true`, exit 0** (gemini /
  gemini-2.5-flash, `repaired: true` per case as expected, `fell_back: false`,
  per-case latency ~10–15 s). The report carries per-case rates + latency +
  provider/model. The live path is resilient: a per-case generation error is
  recorded as an empty case (a benchmark data point), not a crash.
- **Platform**: `apps/ai` suite green; no new dependency; offline mode runs on
  plain `python3` (only the live path imports settings). Nothing persisted, no
  credits spent.
- **Probe**: `--offline` with a missing path → `{"error": "--offline requires a
  file path"}`, exit 2; the failing offline case named both missed thresholds.
