# Exec Plan

## Goal

Give signed-in users a `/dashboard/documents` surface that uploads a PDF into
the RAG storage + jobs foundation and shows live processing status, without the
web app ever owning a status transition.

## Scope

In scope:

- `/dashboard/documents` route (auth-guarded server page).
- Client upload to the `documents` storage bucket at the owner-scoped path.
- Create `documents` row (`uploaded`) and `process_document` `ai_jobs` row
  (`queued`).
- Live document list with status badge, job progress/step, and error display.
- Client-side PDF type + 30 MB size validation.
- Per-document delete (storage object + row).
- Sidebar nav entry "Documents".

Out of scope:

- PDF extraction / chunking / embeddings (US-RAG-005, US-RAG-006).
- Generation rewire and legacy uploader retirement (US-RAG-008).
- Credit ledger (US-RAG-011).
- Any web write to `documents.status` / `ai_jobs.status`.

## Risk Classification

Risk flags:

- Authorization: owner-scoped writes to documents, ai_jobs, and storage under
  RLS.
- Data model: inserts into the RAG corpus and job tables.
- Audit/security: private uploaded PDFs are sensitive; storage path format is
  what the RLS policy authorizes against.
- External systems: Supabase Storage and Postgres via the browser client.

Hard gates:

- Authorization (handled: writes go through the user-session browser client and
  RLS; storage path uses `<user_id>/...`; no service role in the web app).
- External provider behavior (handled: only Supabase Storage/DB, no AI provider
  calls).

## Work Phases

1. Discovery — schema, decisions, runner contract, current code (done).
2. Design — packet (this folder).
3. Validation planning — `validation.md`.
4. Implementation — page, client panel, sidebar nav.
5. Verification — build + browser preview against the test account.
6. Harness update — `harness-cli story add/update`, mark backlog
   US-RAG-004 implemented, record trace.

## Stop Conditions

Pause for human confirmation if:

- Upload would require a service-role key in the web app (it must not).
- The storage path format must deviate from `<user_id>/<document_id>/<file>`.
- The web app would need to write a `status` transition.
- Validation requirements need to be weakened.
