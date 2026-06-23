# Overview

## Current Behavior

The Next.js app lives at the repository root. Source, public assets, app config,
and package scripts are all root-level. The Python AI backend required by the
Lean RAG MVP does not have an app boundary yet.

## Target Behavior

The repository is split into:

- `apps/web` for the existing Next.js app.
- `apps/ai` for the Python FastAPI AI backend scaffold.

Root scripts delegate to the correct app so existing commands like `npm run dev`,
`npm run build`, and `npm run lint` continue to work for the web app.

## Status

implemented

## Affected Users

- Developers working on the web app.
- Developers working on the future AI backend.
- Deployment automation that needs app-specific root directories.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md`
- `docs/decisions/0010-rag-repo-split-clean-cutover.md`

## Non-Goals

- Implement document processing.
- Implement AI jobs.
- Add RAG schema or data migration.
- Add provider integrations.
