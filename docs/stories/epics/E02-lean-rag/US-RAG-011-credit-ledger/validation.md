# Validation

## Proof Strategy

The ledger and the authorization lockdown are proven against a real Supabase
database with `supabase/tests/credit_ledger_test.sql` — one transaction that
creates a throwaway auth user (firing the signup trigger), exercises every RPC,
and ends in `ROLLBACK` so nothing persists. The web wiring is proven by `tsc`,
and the credit-mutation transport is the same service-role admin-client `.rpc`
already used in production by `payments.ts`. No SQL runs in CI (CI has no
database), so this script is the rerunnable proof.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | n/a — the credit logic is SQL RPCs; covered as integration below. |
| Integration | `credit_ledger_test.sql`: signup grant (+3, ledgered); purchase `add_credits(+10)` → 13; `spend_credits(5)` → returns 8, ledger `-5` ref `ai_job`; **insufficient** `spend_credits(100)` raises, balance unchanged, **no** ledger row; `refund_credits(5)` → 13; consistency `credits == SUM(amount)` with exactly 4 rows. |
| E2E (DB) | Same script end-to-end inside one rolled-back transaction; 0 rows persist. |
| Platform | `apps/web` `tsc --noEmit` passes with the admin-client wiring (`spend_credits`/`refund_credits` via `createServiceRoleClient`). |
| Security | Authorization: `add_credits` / `spend_credits` / `refund_credits` denied to the `authenticated` role (PostgREST's user role) and retained for `service_role` — asserted with `SET ROLE`. |
| Release | Additive + idempotent schema; balances neither migrated nor reset; Stripe `payment_events` idempotency untouched; no credits spent in verification. |

## Fixtures

- A throwaway auth user `…0000aa` created and rolled back within the test.
- The dev `.env` `SUPABASE_DB_URL` for `psql`.

## Commands

```text
psql "$SUPABASE_DB_URL" -f supabase/tests/credit_ledger_test.sql
cd apps/web && npx tsc --noEmit -p tsconfig.json
```

## Acceptance Evidence

Verified 2026-06-30 against the dev Supabase DB.

- **Schema applied** (additive block): `credit_transactions`, `spend_credits`,
  `refund_credits`, ledgered `add_credits`/`deduct_credit(s)`/`handle_new_user`,
  and `ai_jobs.credit_cost` all present; re-apply is idempotent
  (`already exists, skipping`).
- **Ledger functional (rolled back, 0 rows persist)** — all six assertions pass:
  signup `+3` (balance_after 3); purchase `+10` → 13; spend `-5` → returns 8,
  balance 8, ref `ai_job`; insufficient `spend_credits(100)` **raised**, balance
  stayed 8, **no ledger row**; refund `+5` → 13; `profiles.credits = 13 =
  SUM(amount)` over exactly 4 rows.
- **Authorization (closes a self-grant exploit)** — under `SET ROLE
  authenticated`, `add_credits` / `spend_credits` / `refund_credits` all raise
  `insufficient_privilege` (denied); `service_role` retains `EXECUTE` on all
  three. (`credit_ledger_test.sql` prints all 10 `OK` lines.)
- **Platform** — `apps/web` `tsc --noEmit`: **No errors found** (admin-client
  `.rpc(..., as never)` wiring, matching `payments.ts`).
- **Not browser-observed** — the user-visible effect (the dashboard credits
  number dropping on a generation, and the insufficient-credits message) is a
  thin read over the verified RPC path; a full upload→generate browser pass was
  not run here (backend-credits change, proven at the data + authorization
  layer, consistent with the prior RAG backend stories).
