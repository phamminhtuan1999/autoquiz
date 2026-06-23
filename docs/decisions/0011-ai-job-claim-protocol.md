# 0011 Use Supabase RPC for AI Job Claiming

Date: 2026-06-23

## Status

Accepted

## Context

The Lean RAG backend needs a Python worker to process PDFs and later generate
regular quizzes, cram content, study reviews, and mock exams. Multiple workers
may run in the future, and job claiming must not depend on a client-side read
followed by a race-prone update. The worker also needs service-role access for
owner-scoped writes without weakening user-facing RLS policies.

## Decision

Use service-role-only Supabase RPC functions as the AI job execution contract:

- `claim_ai_job` atomically selects one queued or stale running job with
  `for update skip locked`, marks it `running`, records `locked_by`, and
  increments `attempt_count`.
- `update_ai_job_progress` heartbeats the lock and updates progress.
- `complete_ai_job` marks a worker-owned running job as `succeeded`.
- `fail_ai_job` either requeues a retryable job or marks it `failed` when retry
  budget is exhausted or the failure is non-retryable.

The Python backend uses these RPCs through the Supabase REST endpoint and keeps
handler implementation separate from the claim lifecycle.

## Alternatives Considered

1. Claim jobs in application code with separate select and update calls.
   Rejected because concurrent workers could claim the same job.
2. Add Redis/Celery immediately. Rejected for MVP because Supabase Postgres is
   already the durable system of record and job volume is not proven yet.
3. Let authenticated users call job lifecycle RPCs. Rejected because the worker
   must perform service-role writes and users should only create/read their own
   job records through RLS.

## Consequences

Positive:

- Job claiming is atomic and safe for more than one worker.
- The service-role boundary is explicit and testable.
- Later Docling/provider/generation handlers can reuse the same runner
  lifecycle.

Tradeoffs:

- Supabase service-role credentials become required for the AI worker runtime.
- Postgres remains the queue backend until volume proves a separate queue is
  needed.
- Live concurrency proof requires a real Supabase/Postgres environment.

## Follow-Up

- US-RAG-005: implement the `process_document` handler.
- US-RAG-008/009/010/012: add generation handlers behind the same runner.
- US-RAG-013: include job lifecycle fixtures in the RAG evaluation suite.
