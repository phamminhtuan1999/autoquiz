# Documentation Map

This directory holds the project harness and any product contract derived from a
future user-provided spec.

## Main Files

- `HARNESS.md`: how humans and agents collaborate.
- `FEATURE_INTAKE.md`: how prompts become tiny, normal, or high-risk work.
- `ARCHITECTURE.md`: architecture discovery and boundary rules.
- `TEST_MATRIX.md`: legacy proof map; current proof status is queried with
  `scripts/bin/harness-cli query matrix`.
- `HARNESS_BACKLOG.md`: legacy improvement list; current improvement records
  are stored with `scripts/bin/harness-cli backlog`.
- `GLOSSARY.md`: shared terms.

## Folders

- `product/`: current product truth, empty until a spec is derived.
- `stories/`: feature packets and backlog.
- `decisions/`: durable decisions and tradeoffs.
- `demo/`: concrete walkthroughs that show how the harness transforms input
  into agent-ready work.
- `templates/`: reusable spec-intake, story, plan, decision, and validation
  formats.

## Current State

As of 2026-06-23, the Harness is active and backed by the local SQLite durable
layer queried through `scripts/bin/harness-cli`.

Durable state snapshot:

- Intakes: 2.
- Stories: 15.
- Decisions: 11.
- Backlog items: 0.
- Traces: 7.

Lean RAG implementation status:

- Implemented: `US-RAG-002`, `US-RAG-003`, `US-RAG-014`, `US-RAG-015`.
- Planned: `US-RAG-001`, `US-RAG-004` through `US-RAG-013`.

Current known proof gaps:

- Live Supabase SQL/RLS/RPC proof is deferred until a real Supabase project and
  service-role credentials are available.
- Coverage and security-scan tools are not registered in the inbound tool
  registry.

Current operational commands:

```bash
scripts/bin/harness-cli query matrix
scripts/bin/harness-cli query traces
scripts/bin/harness-cli query backlog --open
scripts/bin/harness-cli audit
```
