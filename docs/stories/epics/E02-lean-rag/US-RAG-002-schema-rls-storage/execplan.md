# Exec Plan

## Goal

Add the Supabase data/storage foundation that later RAG stories can use without
preserving legacy generated-content history.

## Scope

In scope:

- Enable pgvector.
- Bootstrap private `documents` storage bucket when Supabase Storage is present.
- Add document corpus tables.
- Add provider-specific embedding tables.
- Add AI jobs table.
- Add normalized generated-content tables.
- Add RAG attempt table without colliding with legacy `question_attempts`.
- Add study review table.
- Add retrieval RPCs.
- Add owner-scoped RLS policies.
- Document the data model contract.

Out of scope:

- Destructive cleanup of legacy generated-content tables.
- Data migration from legacy tables.
- Backend job runner implementation.
- Credit transaction ledger implementation.

## Risk Classification

Risk flags:

- Authorization: every RAG table needs owner-scoped RLS.
- Data model: new schema and vector indexes.
- Audit/security: private uploaded PDFs and source text are sensitive.
- External systems: Supabase Storage and pgvector.
- Public contracts: later web/API behavior will depend on these table names.
- Multi-domain: document processing, generation, attempts, reviews, and jobs.

Hard gates:

- Authorization.
- Data model.
- Audit/security.

## Work Phases

1. Add schema objects additively.
2. Add storage bucket/policy bootstrap.
3. Add retrieval RPCs.
4. Add product data-model doc.
5. Create story packet and validation evidence.
6. Run static SQL/text checks and app lint.
7. Update Harness story row and trace.

## Stop Conditions

Pause for human confirmation if:

- A legacy generated-content table must be dropped.
- Billing/account records need migration.
- The schema cannot preserve owner boundaries.
- Retrieval would require global vector search with app-layer filtering.
