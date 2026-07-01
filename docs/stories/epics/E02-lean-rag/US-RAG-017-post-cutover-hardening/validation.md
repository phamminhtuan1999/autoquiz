# Validation

## Proof Strategy

The price change is proven by `tsc` + a browser check that the button renders the
value derived from `CREDIT_PACK`. The RLS change is proven against a real DB: with
the public policy an authenticated user sees all profiles; after dropping it they
see only their own — asserted under rollback so the dev policy is not actually
changed (the human applies the migration).

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | n/a (constant + a `toFixed` label; covered by the browser check). |
| Integration | RLS: under `SET ROLE authenticated` with a JWT `sub`, `select count(*) from profiles` = 5 with the public policy and = 1 after `DROP POLICY`, with the owner's own row still = 1. Edited `schema.sql` re-applies clean; migration `0002` runs (DROP POLICY) under rollback. |
| E2E (browser) | Signed-in dashboard buy button reads **"Buy 10 credits — $9.90"** (no "$4.99"). |
| Platform | `apps/web` `tsc --noEmit` clean with `lib/credits.ts` wired into the button, checkout route, and `payments.ts`. |
| Release | Price unchanged ($9.90); the RLS change is non-destructive (drops an access rule, not data) and user-applied. |

## Commands

```text
cd apps/web && npx tsc --noEmit -p tsconfig.json
psql "$SUPABASE_DB_URL" -f supabase/schema.sql                          # idempotent
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_tighten_profiles_rls.sql   # user applies
```

## Acceptance Evidence

Verified 2026-06-30 (dev DB + dev server).

- **Price single-source**: `lib/credits.ts` (`CREDIT_PACK` = 10 / 990¢) wired into
  `buy-credits-button`, `api/checkout/route` (`unit_amount`/product name), and
  `payments.ts` (`CREDITS_PER_PURCHASE`). `tsc` → **No errors found**.
- **Browser**: signed in, the dashboard buy button reads **"Buy 10 credits —
  $9.90"** (`shows990: true`, `stillShows499: false`); checkout still charges 990¢
  — display and charge now agree.
- **RLS (rolled back)**: `auth.uid()` resolves to the test user;
  `visible_with_public_policy = 5` → after `DROP POLICY "Profiles are public"`,
  `visible_after_drop = 1` and `own_row_still_visible = 1`. Confirms cross-user
  reads are blocked while the owner self-read (dashboard) still works.
- **Schema/migration**: edited `schema.sql` re-applies to the dev DB → exit 0;
  `migrations/0002_tighten_profiles_rls.sql` runs (`DROP POLICY`) under rollback.
