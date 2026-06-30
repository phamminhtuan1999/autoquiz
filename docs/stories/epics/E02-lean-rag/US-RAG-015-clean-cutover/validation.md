# Validation

## Proof Strategy

The original US-RAG-015 packet mapped the cutover; this pass **executes** it (all
four RAG replacement modes shipped, so retirement is unblocked). Proof is: the
web app type-checks and runs with the legacy surfaces removed; the legacy URLs
redirect to the RAG flow in a real browser; the edited `schema.sql` still applies
cleanly; and the destructive cleanup migration's drops execute against a real DB
under rollback (so they are proven without destroying dev data). The migration
itself is authored for the human to apply — it is not run against prod here.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | n/a (no new logic; retirement + redirects). |
| Integration | Edited `schema.sql` re-applies to the dev DB with no error (idempotent; removing a CREATE does not drop). Cleanup migration drops `quizzes`/`question_attempts`/`mock_exams` + `deduct_credit(s)` and runs clean under rollback. |
| E2E (browser) | Signed-in dashboard renders RAG-only nav + the credit cost hint, no legacy quizzes list; landing shows the "Upload a document" CTA (no legacy uploader); legacy `/dashboard/mock-exam` redirects to `/dashboard/documents`; the RAG documents hub loads. No console errors. |
| Platform | `apps/web` `next typegen` + `tsc --noEmit` clean after the route/action/component removals. |
| Logs/Audit | The cleanup migration is explicit that generated history is intentionally discarded and that profiles/credits/payment_events/auth are untouched. |

## Fixtures

- Test account `phamminhtuan1999@gmail.com` (dev) for the browser pass.
- The dev `.env` `SUPABASE_DB_URL` for the schema/migration validation.

## Commands

```text
cd apps/web && npx next typegen && npx tsc --noEmit -p tsconfig.json
psql "$SUPABASE_DB_URL" -f supabase/schema.sql                       # idempotent re-apply
sed 's/^commit;/rollback;/' supabase/migrations/0001_*.sql | psql "$SUPABASE_DB_URL" -f -   # drops, rolled back
```

## Acceptance Evidence

Verified 2026-06-30.

- **Web removals + redirects**: deleted 17 legacy paths (routes
  `dashboard/{quizzes,cram,mock-exam,leaderboard}`, `api/mock-exam`; actions
  `generate-quiz/cram/mock-exam`, `mock-exam-session`, `record-answer`,
  `get-leaderboard`; components `pdf/uploader`, `cram-button`, `mock-exam-button`,
  `interactive-question`, `regular-quiz-display`, `cram-mode-display`); added
  `next.config` redirects for the old URLs → `/dashboard/documents`
  (`/dashboard/leaderboard` → `/dashboard/analytics`). Nav, landing, dashboard,
  and student-home repointed to the RAG documents flow.
- **Type-check**: `next typegen` + `tsc --noEmit` → **No errors found** (the only
  errors before typegen were stale generated route validators for the deleted
  routes; none in `src/`).
- **Browser (signed in, dev)**: sidebar nav = Dashboard / Documents / Review
  queue / Analytics only (no Mock exams / Leaderboard / Cram); dashboard shows the
  Credits card with `regular 1 · cram 3 · mock 5 · review 1` and RAG quick links,
  **no "Recent quizzes" list**; landing "Try it now" shows **Upload a document**
  (legacy uploader gone); `/dashboard/mock-exam` **redirected to
  `/dashboard/documents`**; the documents hub renders ("Upload a PDF to index
  it…"). No console errors.
- **Schema**: edited `schema.sql` re-applies to the dev DB → **exit 0** (only
  idempotent "already exists, skipping" notices). The legacy table/policy/function
  defs are removed from the source.
- **Cleanup migration** (`supabase/migrations/0001_retire_legacy_generated_content.sql`):
  ran under rollback against the dev DB → `DROP TABLE` ×3, `DROP FUNCTION` ×2,
  `ROLLBACK` — proven to execute without persisting (dev legacy rows intact). The
  human applies it to prod after deploy (decision 0010 pre-confirmed discarding
  generated history; profiles/credits/payment_events/auth untouched).
