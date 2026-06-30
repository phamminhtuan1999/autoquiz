# Exec Plan

## Goal

Introduce a credit ledger and meter RAG generation against it, while closing the
credit-mutation authorization hole — keeping balances and Stripe behavior intact
(decision 0015).

## Scope

In scope:

- Schema: `credit_transactions` (+ index, RLS), `ai_jobs.credit_cost`, ledgered
  `add_credits` / `deduct_credit` / `deduct_credits` / `handle_new_user`, new
  `spend_credits` / `refund_credits`, and the `service_role` execute lockdown.
- Web: `enqueue-quiz-generation` reserves/refunds the per-mode cost via the admin
  client; `enqueue-mock-grading` records `credit_cost: 0`.
- `supabase/tests/credit_ledger_test.sql` (functional + authorization proof).
- Decision 0015, story packet.

Out of scope:

- Changing the price economics; new Stripe tiers; billing-history UI.
- Retiring legacy generate actions / revoking `deduct_credit(s)` (US-RAG-015).

## Risk Classification

Risk flags: Authorization, Data model, Audit/security, External systems (Stripe),
Existing behavior, Weak proof. **Lane: high-risk** (multiple hard gates).

Hard gates touched and how they are handled:

- **Authorization** — credit mutation restricted to `service_role`; verified that
  `authenticated` is denied and `service_role` retained.
- **Data model** — additive only (`create … if not exists`, `add column if not
  exists`, `create or replace`); no balance migration or reset; idempotent.
- **Audit/security** — the ledger *is* the audit trail; the self-grant exploit is
  closed.
- **External systems** — Stripe `add_credits` keeps its signature; `payment_events`
  idempotency untouched.

References `rag-clean-cutover.md` (step 3), decision 0015, US-RAG-008/009/012
(the RAG enqueue path), `payments.ts` (the established service-role pattern).

## Work Phases

1. Discovery — map the credit/Stripe surface + current grants; confirm RAG
   enqueue spends nothing and the RPCs are anon/authenticated-callable. (done)
2. Design — ledger, RPCs, enqueue reserve/refund, authz lockdown, decision 0015.
3. Implementation — schema block; enqueue/grading wiring via the admin client.
4. Verification — apply the additive block to the dev DB; run the SQL test
   (ledger behavior + insufficient gate + consistency + authz deny/allow), all
   inside a rolled-back transaction; `tsc`.
5. Harness — intake, story, decision 0015, evidence, trace.

## Stop Conditions

Pause for human confirmation if:

- Preserving balances would require a data migration or reset (it must not — the
  block is additive and idempotent).
- The price economics would have to change to fit the ledger (they must not).
- The authorization lockdown cannot deny `authenticated` while keeping the
  service-role server path working (it can — verified).
- Verifying would require spending real money through Stripe (it must not; the
  Stripe path is unchanged and tested only for idempotency shape).
