# Overview

## Current Behavior

Two loose ends surfaced right after the clean cutover (US-RAG-015):

1. **Credit price drift.** The buy button hard-coded the label `"$4.99"` while the
   Stripe checkout charged `990¢` ($9.90) for the same 10-credit pack, and the
   grant count (10) lived separately in `payments.ts`. A customer clicked "$4.99"
   and landed on a $9.90 checkout.
2. **World-readable profiles.** `public.profiles` still had a `Profiles are public`
   SELECT policy (`using (true)`) left over from the retired leaderboard, exposing
   every user's `email` / `full_name` / `university` / **credit balance** to any
   signed-in (or anon) caller over PostgREST.

## Target Behavior

1. **One source of truth for the credit pack.** `lib/credits.ts` exports
   `CREDIT_PACK` (`credits: 10`, `priceCents: 990`, `currency`) + a price label
   helper. The button, the checkout route, and `payments.ts` all derive from it,
   so the displayed price can never disagree with what Stripe charges. Price is
   **unchanged** ($9.90, per the maintainer); only the misleading label is fixed.
2. **Owner-only profiles.** The `Profiles are public` policy is dropped; only
   `Profiles are self accessible` (`auth.uid() = id`) remains (decision 0016). A
   `DROP POLICY` migration retires it on existing databases.

## Affected Users

- Buyers see the true price ($9.90) before checkout.
- Every user's profile PII + credit balance is no longer readable by other users.

## Affected Product Docs

- `docs/decisions/0016-tighten-profiles-rls.md`
- `docs/product/rag-clean-cutover.md` (the cutover this follows)

## Non-Goals

- Changing the credit price/economics (kept at $9.90 / 10 credits).
- Building a replacement leaderboard or cross-user analytics (a later feature
  would add a scoped view/RPC, not a public policy).
