# Exec Plan

## Goal

Implement the "Evaluation Gates" from `ai-provider-strategy.md` as a runnable,
self-contained gate in `apps/ai`: a deterministic metric library + a release-bar
gate + fixture cases + a live provider-benchmark CLI, so a generation provider can
be measured against a fixed bar and quality regressions are caught.

## Scope

In scope:

- `app/eval/metrics.py` — pure scoring (structural/JSON validity, citation
  validity, duplicate rate, grounding proxy) over raw MCQ items.
- `app/eval/gate.py` — `RELEASE_BAR` + `run_gate` aggregating to a pass/fail
  `GateResult` with named threshold failures.
- `app/eval/fixtures.py` — a few grounded fixture cases (the fixed set).
- `eval_gate.py` CLI — live provider benchmark (default) + offline-from-file.
- Unit tests for metrics + gate (deterministic).
- Decision 0014 (gate design).

Out of scope:

- LLM-judge quality/hallucination metrics; cost accounting / latency gating; CI
  wiring; embedding/retrieval evaluation.

## Risk Classification

Risk flags:

- Public contracts (introduces the `RELEASE_BAR` thresholds + the gate report
  shape as an internal contract).
- Weak proof (this *is* proof infrastructure; the eval code itself is unit-tested
  to prevent it from regressing).

Hard gates:

- None. Additive `apps/ai` tooling — no auth, authorization, data model, audit,
  or external-provider-behavior change. The live benchmark only **reads** the
  existing US-RAG-007 generation service. (Backlog pre-marked US-RAG-013
  high-risk as an epic-wide estimate; the actual blast radius is additive.)

References `ai-provider-strategy.md` (the Evaluation Gates + release bar),
US-RAG-007 (the generation service the benchmark calls), US-RAG-008 (the
generation schema/shape scored), decision `0014`.

## Work Phases

1. Discovery — `ai-provider-strategy.md` Evaluation Gates, the generation service
   + schema/prompt surface, the raw item shape. (done)
2. Design — metric library, gate, fixtures, CLI, decision 0014 (this packet).
3. Validation planning — `validation.md`.
4. Implementation — `app/eval/{metrics,gate,fixtures}.py`, `eval_gate.py`, tests.
5. Verification — unit suite green; a live benchmark smoke run against Gemini
   (scratchpad venv) producing a report + a gate decision.
6. Harness update — `decision add 0014`, `story add US-RAG-013`, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- Measuring a documented metric would require changing a generation handler's
  behavior (it must not — the gate only reads/scores).
- The release-bar thresholds would need to differ from `ai-provider-strategy.md`
  (that doc is the source of truth; a change there is a separate decision).
- A live benchmark would need to spend credits or write any data (it must not).
