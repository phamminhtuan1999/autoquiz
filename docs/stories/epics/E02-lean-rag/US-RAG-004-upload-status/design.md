# Design

## Domain Model

- **Document**: one uploaded PDF owned by a user. Carries the storage path and
  the processing `status` state machine
  (`uploaded → processing → ready | failed | unsupported`). Owner-scoped by
  `user_id` via RLS.
- **Process job**: an `ai_jobs` row of `job_type = 'process_document'` that the
  Python worker will claim. Carries `progress`, `current_step`, and an `input`
  jsonb that points back at the document
  (`{ document_id, storage_path }`).

Business rules:

- `documents.id` is generated client-side (UUID) so it can appear in the
  storage object path **before** upload.
- Storage path is exactly `<user_id>/<document_id>/<original_filename>` so the
  storage RLS policy (`(storage.foldername(name))[1] = auth.uid()`) authorizes
  the write.
- The web app never sets `status` beyond the initial insert defaults
  (`documents.status = 'uploaded'`, `ai_jobs.status = 'queued'`).

## Application Flow

Upload (client, authenticated browser Supabase client, RLS-gated):

1. Validate file is `application/pdf` and `≤ 30 MB` (bucket also enforces both).
2. `docId = crypto.randomUUID()`; `path = ${user.id}/${docId}/${fileName}`.
3. `storage.from('documents').upload(path, file)`.
4. `insert into documents (id, user_id, title, original_filename, storage_path,
   file_size_bytes)` — `status` defaults to `'uploaded'`.
5. `insert into ai_jobs (user_id, job_type='process_document',
   input={document_id, storage_path})` — `status` defaults to `'queued'`.
6. Compensation: if step 4 fails, remove the uploaded object; if step 5 fails,
   the document remains `'uploaded'` (a worker can still be enqueued later) and
   the error is surfaced.

Status read (client, polling):

- Initial document list is fetched server-side for first paint.
- The client polls `documents` + the user's `process_document` `ai_jobs` every
  ~4s **only while** at least one document is in a non-terminal state
  (`uploaded` / `processing`); polling stops when all are terminal.

Delete (client):

- Remove the storage object, then `delete from documents where id = ?` (RLS
  scopes to owner). The orphan `process_document` job is harmless and ignored.

## Interface Contract

No new HTTP API routes. All data access is through the browser Supabase client
under the user session and RLS:

- `storage.from('documents').upload(path, file)` / `.remove([path])`
- `from('documents').select(...)` / `.insert(...)` / `.delete()`
- `from('ai_jobs').select(...)` / `.insert(...)`

Errors surfaced to the UI: oversize, wrong-type, storage upload failure,
row-insert failure, and per-document `processing_error` / job `error_message`.

## Data Model

No schema change. Writes use existing tables from US-RAG-002/003:

- `documents` (insert: `id, user_id, title, original_filename, storage_path,
  file_size_bytes`).
- `ai_jobs` (insert: `user_id, job_type, input`).
- `storage.buckets` id `documents` (private, PDF-only, 30 MB).

Existing indexes already cover the reads (`documents_user_status_idx`,
`ai_jobs_claimable_idx`).

## UI / Platform Impact

- New route `apps/web/src/app/dashboard/documents/page.tsx` (server component,
  auth guard, `force-dynamic`).
- New client component `apps/web/src/components/documents/documents-panel.tsx`
  (upload control + live list + delete).
- New sidebar nav entry "Documents" in
  `apps/web/src/components/ui/app-sidebar.tsx`.
- All styling uses DESIGN.md role tokens; no `slate-*`, no emojis.

## Observability

- Client surfaces upload/processing errors inline.
- Durable processing state lives in `documents.status` / `ai_jobs` and is the
  observability surface the worker writes to; the web app reads it.

## Alternatives Considered

1. **Replace the landing uploader** — rejected: the landing demo is anonymous,
   and RLS-gated storage needs a signed-in user. Deferred to US-RAG-008.
2. **Supabase Realtime subscription instead of polling** — deferred: realtime
   publication config is not guaranteed in all environments; polling is robust
   for this slice and bounded (stops on terminal states).
3. **Server action for upload** — rejected for the storage write: the
   authenticated browser client already satisfies storage RLS directly and
   avoids streaming the file through the Next.js server.
