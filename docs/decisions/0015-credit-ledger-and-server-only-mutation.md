# 0015 Credit Ledger and Server-Only Credit Mutation

Date: 2026-06-30

## Status

Accepted

## Context

Credits were a single mutable integer, `profiles.credits` (default 3), changed
in place by `add_credits` / `deduct_credit` / `deduct_credits`. Three gaps:

1. **No audit trail.** Nothing recorded *why* a balance changed; the only history
   was `payment_events` (purchases) — spends left no trace.
2. **RAG generation was free.** Credit checks/deductions lived only in the legacy
   direct-Gemini actions (`generate-quiz/cram/mock-exam`); the RAG enqueue path
   (`enqueue-quiz-generation`) recorded `credit_cost=0` and spent nothing, with a
   standing `// US-RAG-011 owns credit spend` marker.
3. **A self-grant authorization hole.** The credit RPCs are `SECURITY DEFINER`
   in the `public` schema and were `EXECUTE`-granted to `anon` and
   `authenticated` (the Supabase default). Any signed-in user could call
   `rpc('add_credits', { p_user_id: <self>, p_amount: 999999 })` over PostgREST
   to mint credits, or `spend_credits`/`deduct_credits` against another user's id
   to drain them. The trusted caller (`payments.ts`) already used the
   service-role client, so the broad grant was pure attack surface.

The clean-cutover product doc (`rag-clean-cutover.md`, step 3) scopes US-RAG-011
as "add `credit_transactions` and keep current credit balance intact."

## Decision

1. **Append-only ledger.** Add `public.credit_transactions` (signed `amount`,
   `balance_after` snapshot, `reason`, optional `ref_type`/`ref_id`). Keep
   `profiles.credits` as the authoritative running balance; every mutation also
   writes a ledger row. Balances are **not** migrated or reset. RLS: owner-select
   only; rows are written exclusively by the `SECURITY DEFINER` RPCs.

2. **RAG generation spends, reserving at enqueue.** `enqueue-quiz-generation`
   debits the per-mode cost via a new `spend_credits(user, amount, reason, ref)`
   that atomically gates on balance, deducts, and ledgers — *before* inserting
   the job, because the worker runs asynchronously (otherwise a low balance could
   queue unlimited work). If the job row then fails to insert, `refund_credits`
   returns the reserved amount. Costs preserve the legacy economics exactly —
   regular 1, cram 3, mock 5 — plus a modest study-review cost (1); mock grading
   is free (covered by the mock generation charge). The cost is recorded on
   `ai_jobs.credit_cost`.

3. **Server-only credit mutation.** Revoke `EXECUTE` on `add_credits`,
   `spend_credits`, and `refund_credits` from `public`/`anon`/`authenticated`;
   grant only to `service_role`. The server actions authenticate the user and
   pass the verified id while calling through the service-role admin client,
   never the user session. Stripe top-ups (`payments.ts`) already used that
   client. The signup grant (default 3) is ledgered in `handle_new_user`.

Stripe behavior is unchanged: `payment_events.session_id` still enforces
idempotency; `add_credits` keeps its signature and now also ledgers `'purchase'`.

## Alternatives Considered

1. **Derive the balance from `SUM(amount)` and drop `profiles.credits`.**
   Rejected: keeps a cheap single-column read for the common "show my balance"
   path, avoids touching every existing reader, and preserves the column the
   cutover doc says to keep. Consistency is asserted (`credits == SUM(amount)`).
2. **Guard each RPC with `p_user_id = auth.uid()` instead of a service-role
   lockdown.** Rejected: a self-equality guard cannot secure *grants*
   (`add_credits`/`refund_credits`) — a user passing their own id would still
   mint credits. Service-role-only is the correct trust boundary.
3. **Lock down the legacy `deduct_credit`/`deduct_credits` now too.** Deferred:
   they are still called by the legacy generate actions via the user session and
   are retired together in US-RAG-015. They allow griefing (reducing a balance)
   but not theft or self-grant; the high-severity self-grant holes are closed now.

## Consequences

Positive:

- Full, queryable credit history; the balance is reconcilable to the ledger.
- RAG generation is metered; balances can no longer be bypassed by using the RAG
  path. Insufficient balance returns a clear top-up message.
- The self-grant / cross-user-drain exploit is closed; credit mutation is a
  trusted server operation.

Tradeoffs:

- Credit mutation now requires the service-role client in server code (a small
  ceremony, already established by `payments.ts`).
- Legacy `deduct_credit`/`deduct_credits` keep their broad grant until US-RAG-015
  removes them with the legacy actions.
- No SQL test runs in CI (CI has no database); the ledger + authorization proof
  is the committed, rerunnable `supabase/tests/credit_ledger_test.sql`.

## Follow-Up

- US-RAG-015: retire the legacy generate actions and revoke
  `deduct_credit`/`deduct_credits`.
- Later: a credit-balance widget reading the ledger; optional per-mode price
  surfacing in the generation UI.
