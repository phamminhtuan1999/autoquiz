# Validation

## Proof Strategy

The change is web-side and observable in the browser. Proof is: a clean
production build, and a runtime walk of `/dashboard/documents` under the test
account showing (a) an upload creating a `documents` row + `process_document`
job, (b) the live status UX rendering the `uploaded`/`processing` states with
DESIGN.md tokens and no emojis, and (c) validation/error paths. Because no
worker runs yet, `ready` is not reachable in this story; the reachable states
(`uploaded`, `queued` job, and error paths) are what gets verified.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | (none — no pure logic extracted; behavior is integration-shaped) |
| Integration | Upload writes a `documents` row + `process_document` `ai_jobs` row owned by the user; delete removes object + row |
| E2E | Browser: upload a PDF on `/dashboard/documents`, list shows the doc as "Uploaded / queued"; reject a non-PDF and a >30 MB file with inline errors |
| Platform | `next build` exits 0; `/dashboard/documents` renders; sidebar "Documents" link active state works |
| Performance | Polling stops once all documents are terminal (no infinite poll) |
| Logs/Audit | Processing state observable via `documents.status` / `ai_jobs`; web never writes status |

## Fixtures

- Test account: `phamminhtuan1999@gmail.com` (preview login).
- A small sample PDF for upload.

## Commands

```text
cd apps/web && npm run build
# preview: dev server on :3000, sign in, visit /dashboard/documents
```

## Acceptance Evidence

Verified 2026-06-23.

- **Build**: `next build` exits 0; `/dashboard/documents` registered (dynamic).
- **Provisioning**: `supabase/schema.sql` applied to project `hlwdukxfbpjowoqbqnba`
  via session-pooler `psql`. Two pre-existing schema defects fixed to apply
  cleanly (see backlog #4): ivfflat index on `vector(3072)`; match RPC
  `search_path` missing `extensions`. Post-apply: `documents`/`ai_jobs` RLS on
  with owner policies, `storage.objects` documents policy present, `documents`
  bucket private (30 MB), `claim_ai_job` RPC present.
- **Happy path (E2E, test account, live Supabase)**: upload created a
  `documents` row (`status=uploaded`), a `process_document` `ai_jobs` row
  (`queued`, `input.document_id` matches), and a storage object at
  `<user_id>/<document_id>/<file>`. UI rendered the "Queued" badge +
  "waiting for a worker" copy.
- **Validation paths**: non-PDF → "Only PDF files are supported.";
  31 MB PDF → "PDF must be 30 MB or smaller." (both client-side, pre-network).
- **Missing-bucket error path** (pre-provisioning) surfaced cleanly with no
  orphaned rows.
- **Delete**: removed the `documents` row and the storage object; orphan
  `process_document` job left intact (by design).
- **Dark mode**: page + error/badge tokens verified on the dark palette.
- Reachable states only: `ready`/`processing` require the US-RAG-005 worker,
  which does not exist yet.
