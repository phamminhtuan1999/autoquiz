# Validation

## Proof Strategy

The workflow is proven two ways: **locally**, by running each CI step with the
exact command the workflow uses (so a green local run predicts a green CI run),
and **on CI**, by watching the `ai` and `web` jobs run to green on this story's
own pull request (the `pull_request` trigger runs the new workflow against the PR
that introduces it). The golden-cases file is proven by the offline gate exiting
0 on it; a deliberately broken case is shown to fail (exit 1) so the step is not
a no-op.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `apps/ai` suite (`python -m unittest discover -s tests`) runs green on a bare interpreter with no third-party deps — the same command the `ai` job runs. |
| Integration | Offline eval gate: `python eval_gate.py --offline tests/fixtures/eval_offline_cases.json` exits 0 on the golden set (json/citation 1.0, dup 0.0); a tampered case (dangling citation) exits 1 and names the missed threshold — proving the CI step is a real gate. |
| E2E | The workflow runs on the PR: `ai` job green (tests + offline gate), `web` job green (`npm ci` → `next typegen` → `tsc --noEmit`). |
| Platform | Web type-check reproduced under clean-checkout conditions (no `.next/`, no `next-env.d.ts`): `next typegen` exit 0, then `tsc --noEmit` exit 0. YAML parses. |
| Release | CI runs on `pull_request` and `push` to `main`; least-privilege `permissions`; offline only — no network, no credits, no data written. |

## Fixtures

- `apps/ai/tests/fixtures/eval_offline_cases.json` — two grounded cases
  (cell-biology, basic-physics), five clean MCQ items.
- The existing `apps/ai` unit fixtures (US-RAG-013) exercise the gate logic the
  offline step depends on.

## Commands

```text
# ai job (as CI runs it)
cd apps/ai && PYTHONPATH=. python3 -m unittest discover -s tests
cd apps/ai && PYTHONPATH=. python3 eval_gate.py --offline tests/fixtures/eval_offline_cases.json

# web job (as CI runs it)
npm ci
cd apps/web && npx next typegen && npx tsc --noEmit -p tsconfig.json
```

## Acceptance Evidence

Verified 2026-06-29.

- **ai unit suite (bare interpreter, no deps)**: `cd apps/ai && PYTHONPATH=.
  python3 -m unittest discover -s tests` → **Ran 125 tests … OK** in ~0.004s on a
  clean `python3` (no venv, no pip install) — confirming the `ai` job needs no
  dependency step.
- **Offline eval gate (golden)**: `python3 eval_gate.py --offline
  tests/fixtures/eval_offline_cases.json` → `passed: true`, `cases: 2`,
  `items: 5`, aggregate `json_validity 1.0, citation_validity 1.0,
  duplicate_rate 0.0, grounding_rate 1.0`, **exit 0**.
- **Offline gate is a real gate (negative)**: a tampered copy with a dangling
  citation → `passed: false`, failure names `citation_validity … < 0.95`,
  **exit 1**. _(see CI-proof note below)_
- **Web type-check on a clean checkout**: with `.next/` and `next-env.d.ts` moved
  aside to reproduce a fresh CI checkout, `npx next typegen` → `✓ Types generated
  successfully`, exit 0; `npx tsc --noEmit -p tsconfig.json` → **exit 0**. Local
  dev artifacts restored afterward.
- **CI run (PR)**: `ai` and `web` jobs green on the introducing PR — _populated
  once the PR run completes._
