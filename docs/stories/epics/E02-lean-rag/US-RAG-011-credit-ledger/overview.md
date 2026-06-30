# Overview

## Current Behavior

Credits are a single mutable integer `profiles.credits` (default 3), changed in
place by `add_credits` / `deduct_credit` / `deduct_credits`. Three gaps:

- **No spend history.** Only `payment_events` records purchases; deductions leave
  no trace, so a balance cannot be reconciled or audited.
- **RAG generation is free.** Credit checks/deductions live only in the legacy
  direct-Gemini actions. The RAG enqueue path records `credit_cost=0` and spends
  nothing (a standing `// US-RAG-011 owns credit spend` marker).
- **A self-grant authorization hole.** The credit RPCs are `SECURITY DEFINER` in
  `public` and `EXECUTE`-granted to `anon`/`authenticated`, so any signed-in user
  could call `add_credits` over PostgREST to mint themselves credits, or
  `spend_credits`/`deduct_credits` against another user's id to drain them.

## Target Behavior

An append-only **credit ledger** plus metered, server-trusted credit mutation
(decision 0015):

- `credit_transactions` records every movement (signed amount, balance snapshot,
  reason, optional `ai_job`/`payment_event` ref). `profiles.credits` stays the
  authoritative running balance; balances are neither migrated nor reset.
- RAG generation **spends** the per-mode cost, reserved atomically at enqueue
  time via `spend_credits` (gate + deduct + ledger) and refunded if the job fails
  to queue. Costs preserve the legacy economics: regular 1, cram 3, mock 5; study
  review 1; mock grading 0. Recorded on `ai_jobs.credit_cost`.
- Credit-mutating RPCs (`add_credits`, `spend_credits`, `refund_credits`) are
  restricted to `service_role`; server actions authenticate the user and call
  through the admin client with the verified id.

## Affected Users

- Every user — generation now costs credits regardless of mode; an insufficient
  balance shows a clear top-up message. Purchased credits and Stripe behavior are
  preserved. The self-grant / cross-user-drain exploit is closed.

## Affected Product Docs

- `docs/product/rag-clean-cutover.md` (step 3: add `credit_transactions`, keep
  the balance intact).
- `docs/product/lean-rag-mvp.md` (the credit/job substrate the RAG modes reuse).
- `docs/decisions/0015-credit-ledger-and-server-only-mutation.md`.

## Non-Goals

- Redesigning the price/credit economics (preserved exactly; only study-review
  gets a new modest cost).
- New Stripe products/tiers or a billing-history UI.
- Deriving the balance purely from the ledger (kept as a cached column).
- Retiring the legacy generate actions or their `deduct_credit(s)` grants — that
  is US-RAG-015.
