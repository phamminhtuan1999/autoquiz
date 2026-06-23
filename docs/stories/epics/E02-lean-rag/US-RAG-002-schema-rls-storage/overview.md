# Overview

## Current Behavior

The database has account, credit, payment, legacy quiz, legacy attempt, and
legacy mock-exam tables. There is no persisted document corpus, vector index,
RAG job table, normalized generated-content model, study review model, or
document storage bucket contract.

## Target Behavior

The database has an additive Lean RAG foundation:

- private `documents` storage bucket
- document, page, chunk, and embedding tables
- provider-specific OpenAI and Gemini vector tables
- RAG retrieval RPCs scoped by user and document
- AI job table
- normalized quiz set, question, answer option, attempt, and study review tables
- owner-scoped RLS on every RAG table

## Status

implemented

## Affected Users

- Students retain accounts, credits, and payment state.
- Future RAG generation flows can persist document indexes and source-grounded
  generated content.
- Legacy generated history is not migrated or dropped by this story.

## Affected Product Docs

- `docs/product/lean-rag-mvp.md`
- `docs/product/rag-clean-cutover.md`
- `docs/product/rag-data-model.md`
- `docs/product/ai-provider-strategy.md`

## Non-Goals

- Implement PDF processing.
- Implement job claiming.
- Implement AI provider calls.
- Migrate or drop legacy generated-content tables.
- Add credit transaction ledger behavior.
