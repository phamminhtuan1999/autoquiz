# Design

## Workflow shape

Single workflow `.github/workflows/ci.yml`, two parallel jobs, least-privilege
`permissions: contents: read`, and a `concurrency` group that cancels superseded
runs for the same ref.

Triggers: `pull_request` (covers every PR branch) + `push` to `main` (covers the
post-merge state). This avoids double-running on PR branches while still gating
both the PR and `main`. Because the workflow is added on the feature branch, the
`pull_request` event runs it on its own introducing PR.

## `ai` job

```yaml
working-directory: apps/ai
- actions/setup-python@v5  with python-version "3.13"
- PYTHONPATH=. python -m unittest discover -s tests
- PYTHONPATH=. python eval_gate.py --offline tests/fixtures/eval_offline_cases.json
```

- **No `pip install`.** `apps/ai` has no `requirements.txt`/`pyproject.toml`; the
  test suite and the offline eval path are pure stdlib. `pydantic-settings` is
  imported only by `app/config.py`, which only the **live** eval path touches —
  the offline CLI and the tests never import it. Verified by running the suite and
  the offline CLI on a bare interpreter.
- Python `3.13`: the code uses `X | None` unions, PEP 585 generics, and
  `from __future__ import annotations`; nothing requires 3.14.

## `web` job

```yaml
- actions/setup-node@v4  with node-version "22", cache: npm
- npm ci                              # repo root — npm workspace over apps/web
- (working-directory: apps/web) npx next typegen
- (working-directory: apps/web) npx tsc --noEmit -p tsconfig.json
```

- **`npm ci` at the root.** The root `package.json` declares
  `workspaces: ["apps/web"]`; one install hydrates the hoisted `node_modules`.
  `apps/web`'s `postinstall` (copies the pdf.js worker) is guarded with `|| true`,
  so it cannot fail CI.
- **`next typegen` before `tsc`.** On a clean checkout there is no `.next/` and no
  `next-env.d.ts` (both gitignored). `tsconfig.json` includes `.next/types/**`,
  `.next/dev/types/**`, and `next-env.d.ts`; missing **glob** includes are
  harmless, but the absent `next-env.d.ts` would drop Next's global type
  references. `next typegen` regenerates `next-env.d.ts` + route types **without a
  full build**, so it needs no env and no Supabase secrets — confirmed by
  reproducing the clean-checkout condition locally (typegen exit 0, then tsc
  exit 0). Typed routes are off, so no source references generated route types.

## Offline golden cases

`apps/ai/tests/fixtures/eval_offline_cases.json` — two grounded cases
(cell-biology, basic-physics), five hand-authored clean MCQ items: four options
each, in-range citations, distinct prompts. Scored via `_run_offline`, which
builds `SourceChunk`s (0-based `chunk_index`; items cite 1-based `source_chunk`)
and runs the same `run_gate`. The set clears the bar (json/citation 1.0, dup 0.0,
grounding 1.0) → `passed: true`, exit 0. It lives under `tests/fixtures/` (data
only, no `test_*.py`), so `unittest discover` ignores it.

## Why offline, not live, in CI

The live benchmark proves a *provider* clears the bar; CI proves the *gate code +
golden output* still agree. Offline is deterministic, free, and network-free —
the right CI signal. The live path is unchanged and remains a local/manual run.

## Domain rules

- CI must spend no credits and write no data (offline only).
- CI installs no Python deps (stdlib-only path) — adding one is a design change.
- The release bar lives in `app/eval/gate.py` / `ai-provider-strategy.md`; CI
  enforces it but does not redefine it.
