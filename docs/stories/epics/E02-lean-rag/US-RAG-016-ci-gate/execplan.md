# Exec Plan

## Goal

Stand up the repo's first CI workflow so the `apps/ai` unit suite, the eval
release bar (offline), and the `apps/web` type-check run automatically on every
pull request and on pushes to `main` — turning previously by-hand proof into an
enforced gate.

## Scope

In scope:

- `.github/workflows/ci.yml` — `ai` job (unit suite + offline eval gate) and
  `web` job (`npm ci` + `next typegen` + `tsc --noEmit`).
- `apps/ai/tests/fixtures/eval_offline_cases.json` — committed golden cases for
  the offline gate step (a seed of the corpus from decision 0014).
- Story packet.

Out of scope:

- Live provider benchmark in CI; full `next build`/deploy/lint/e2e; version
  matrices; branch-protection/required-checks; coverage; growing the golden
  corpus.

## Risk Classification

Risk flags:

- Weak proof (this *is* proof infrastructure; it closes a gap rather than
  changing behavior).

Hard gates:

- None. Purely additive ops tooling. No auth, authorization, data model, audit,
  external-provider behavior, or public-contract change. CI only **reads** the
  repo, runs existing tests, runs the eval gate offline (no network/credits), and
  type-checks. (Backlog estimates can pre-mark RAG items high-risk; the actual
  blast radius here is additive — confirmed at intake, lane `normal`.)

References `ai-provider-strategy.md` (the release bar enforced offline),
US-RAG-013 (`eval_gate.py` + `app/eval/*` the `ai` job runs), `docs/HARNESS.md`.

## Work Phases

1. Discovery — confirm no CI exists; confirm ai suite + offline eval run on a
   bare interpreter (no deps); confirm the npm workspace layout; reproduce the
   clean-checkout web type-check (`next typegen` → `tsc`). (done)
2. Design — workflow shape, job commands, golden-cases format (this packet).
3. Implementation — `ci.yml`, `eval_offline_cases.json`.
4. Verification — run each CI command locally exactly as the workflow does; lint
   the YAML; confirm the golden gate exits 0; confirm clean-checkout web path.
5. CI proof — push the branch, open the PR, watch the `ai` and `web` jobs go
   green on the PR itself.
6. Harness update — `story add US-RAG-016`, `story update --verify`, evidence,
   trace.

## Stop Conditions

Pause for human confirmation if:

- Making CI pass would require installing a Python dependency (the ai path must
  stay stdlib-only) or running a full `next build` with secrets.
- The web type-check cannot be made reliable on a clean checkout without env
  secrets (it can — via `next typegen`).
- CI would need to spend credits or hit the network to run the eval gate (it must
  not; offline only).
