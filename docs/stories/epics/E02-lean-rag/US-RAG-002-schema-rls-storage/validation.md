# Validation

## Proof Strategy

This story adds SQL schema and contracts. In this environment, validation is
static plus app lint. Full integration proof requires a Supabase project with
Storage and pgvector enabled.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | n/a |
| Integration | Later: apply `supabase/schema.sql` to Supabase; insert users/documents/pages/chunks/jobs; verify RLS isolation; verify storage policy path ownership; verify vector RPCs. |
| E2E | Later: upload PDF -> document row/job -> backend processing -> ready document. |
| Platform | `git diff --check`; `npm run lint`. |
| Performance | Later: benchmark vector search latency on representative chunk counts. |
| Logs/Audit | Later: verify `ai_jobs` status/error fields support processing trace. |

## Fixtures

Future integration proof should use:

- two authenticated users
- one PDF per user
- pages/chunks/embeddings for each user
- one queued job per user
- one quiz set/question/answer option per user
- RAG attempt and study review rows per user

## Commands

```text
git diff --check
npm run lint
```

## Acceptance Evidence

- `git diff --check` passed.
- `npm run lint` passed. It prints a stale `baseline-browser-mapping` advisory.
- No coverage/security-scan tools were registered in Harness, so those
  capabilities were clean skips.
