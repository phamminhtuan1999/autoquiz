# Exec Plan

## Goal

Create the `apps/web` and `apps/ai` boundaries required by the Lean RAG MVP
without changing current product behavior.

## Scope

In scope:

- Move the current Next.js app into `apps/web`.
- Add a minimal FastAPI scaffold under `apps/ai`.
- Update root npm scripts to delegate to the web workspace and AI scaffold.
- Refresh npm workspace metadata.
- Update README commands and project structure.
- Verify web lint/build and AI health import.

Out of scope:

- RAG ingestion.
- Database schema changes.
- AI provider calls.
- Job queue implementation.
- Clean cutover of legacy generated data.

## Risk Classification

Risk flags:

- Public contracts: developer commands and app root paths change.
- Existing behavior: the web app must continue to build and lint after moving.
- Cross-platform: future deployments now have app-specific roots.
- Weak proof: Python dependencies may not be installed in every environment.

Hard gates:

- None for product data/auth behavior in this story. The split itself does not
  change runtime auth, RLS, payment, or provider behavior.

## Work Phases

1. Create `apps/web` and `apps/ai` directories.
2. Move web app files into `apps/web`.
3. Convert root `package.json` to npm workspaces.
4. Add FastAPI health scaffold.
5. Update docs and story packet.
6. Run verification commands.
7. Record Harness evidence.

## Stop Conditions

Pause for human confirmation if:

- The app cannot build from `apps/web` without changing product code.
- npm workspace conversion requires dependency version changes.
- The repo needs a deployment-specific choice not covered by the accepted split.
