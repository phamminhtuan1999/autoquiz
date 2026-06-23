# Exec Plan

## Goal

Add the durable AI job claim protocol and Python runner contract needed before
PDF extraction and RAG generation handlers are implemented.

## Scope

In scope:

- Add atomic Supabase RPCs for claim/progress/complete/fail.
- Add lock owner and retry budget fields to `ai_jobs`.
- Add Python job models, repository, runner, and `run_once` entrypoint.
- Add deterministic unit tests for runner lifecycle behavior.
- Update product docs, story packet, decision records, and Harness status.

Out of scope:

- Live Supabase migration execution.
- Docling extraction.
- Provider calls.
- Browser job creation/status UI.

## Risk Classification

Risk flags:

- Data model.
- Authorization.
- External systems.
- Public contracts.
- Weak proof.

Hard gates:

- Authorization.
- External provider/service behavior.

Lane: high-risk.

## Work Phases

1. Discovery.
2. Design.
3. Validation planning.
4. Implementation.
5. Verification.
6. Harness update.

## Stop Conditions

Pause for human confirmation if:

- Job ownership needs to move out of Supabase.
- User-callable worker lifecycle RPCs are requested.
- Live migration requires destructive schema changes.
- Validation must be weakened below static SQL checks plus runner unit tests.
