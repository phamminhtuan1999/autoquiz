# Validation

## Proof Strategy

Use unit tests for Python runner behavior and static build/lint checks for the
repo. The SQL contract is reviewed statically in `supabase/schema.sql`; live
Supabase migration/concurrency proof is deferred until Supabase credentials are
available.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Runner completes a claimed job, reports idle when no job exists, fails unknown job types without retry, and requeues handler errors through `fail`. |
| Integration | Deferred: apply schema to Supabase and verify RPC lock ownership with service-role credentials. |
| E2E | Not applicable; no browser surface in this story. |
| Platform | `npm run ai:health`; Vercel web build remains outside this backend runner story. |
| Performance | `claim_ai_job` uses an indexed status/created/lock scan and `for update skip locked`. |
| Logs/Audit | Job rows capture status, step, error, attempts, lock owner, and timestamps. |

## Fixtures

- Fake in-memory job repository for unit tests.
- Static SQL in `supabase/schema.sql`.

## Commands

```text
npm run ai:test
npm run ai:health
git diff --check
```

## Acceptance Evidence

- `npm run ai:test` passed: 4 unit tests cover complete, idle, unsupported, and
  retryable failure paths.
- `npm run ai:run-once` passed and returned `not_configured`, proving no live
  jobs are claimed while handlers are absent.
- `npm run ai:health` passed.
- `npm run lint` passed.
- `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run build` passed.
- `git diff --check` passed.
- Live Supabase RPC/concurrency proof was not run because no Supabase service
  credentials were provided in this environment.
