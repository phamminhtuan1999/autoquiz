# Overview

## Current Behavior

The Lean RAG schema has an `ai_jobs` table, but there is no atomic claim
protocol and the Python backend only exposes `/health`.

## Target Behavior

The Python AI backend has a runner contract that can claim one queued AI job
through a service-role-only Supabase RPC, execute the matching handler, and
complete, retry, or fail the job through the same lock ownership contract.
Until concrete handlers are implemented, the CLI exits without claiming live
jobs.

## Affected Users

- Students uploading PDFs or generating RAG content indirectly depend on job
  status once upload/generation UI is wired.
- Operators running the Python AI backend need Supabase service-role
  configuration.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md`
- `docs/product/rag-data-model.md`
- `docs/decisions/0011-ai-job-claim-protocol.md`

## Non-Goals

- Docling PDF extraction.
- Embedding generation.
- Regular quiz, cram, study review, or mock exam generation.
- Browser upload/status UX.
