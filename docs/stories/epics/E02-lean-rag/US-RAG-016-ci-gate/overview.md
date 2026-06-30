# Overview

## Current Behavior

The repo has **no CI**. There is no `.github/workflows/` at all. The `apps/ai`
unit suite (125 stdlib `unittest` tests, including the US-RAG-013 evaluation
metrics + release-bar gate) and the `apps/web` type-check run **only when a
developer remembers to run them by hand**. A regression — a broken metric, a
malformed type, a citation-gate bug — can merge unnoticed because nothing checks
it on a push or pull request. The eval gate exists but is never exercised
automatically, so the very thing meant to catch quality drift is itself
unguarded.

## Target Behavior

A first CI workflow (`.github/workflows/ci.yml`) that runs on every pull request
and on pushes to `main`, with two independent jobs:

- **`ai`** — runs the full `apps/ai` `unittest` suite (no third-party deps), then
  runs the **eval gate in offline mode** (`eval_gate.py --offline`) against a
  small committed golden-cases file. This executes the real CLI end to end (arg
  parsing, `_run_offline`, scoring, exit code) with **no network and no credits**,
  and fails the build if the golden output stops clearing the release bar.
- **`web`** — installs the npm workspace, generates Next route types
  (`next typegen`, no full build / no env required), and type-checks
  (`tsc --noEmit`).

The live provider benchmark (`python eval_gate.py`) is intentionally **not** in
CI: it needs a provider key and spends credits. It stays a local/manual step.

## Affected Users

- Maintainer — gets an automatic red/green signal on every PR, so the ai suite
  and the eval release bar can no longer silently regress, and the web app can no
  longer merge with type errors.

## Affected Product Docs

- `docs/product/ai-provider-strategy.md` — the release bar the offline gate
  enforces in CI (via US-RAG-013).
- `docs/HARNESS.md` — proof/validation cadence this automates.

## Non-Goals

- Running the **live** provider benchmark in CI (needs secrets + credits).
- A full `next build` / deploy / lint / e2e in CI — type-check is the chosen
  bounded first signal for web; Vercel already builds on deploy.
- Coverage gates, matrix builds across Python/Node versions, or required-status
  branch protection (a later ops step once the workflow is proven green).
- Growing the golden corpus beyond the seed cases (future work, decision 0014).
