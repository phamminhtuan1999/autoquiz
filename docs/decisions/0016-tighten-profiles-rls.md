# 0016 Tighten profiles RLS — drop the world-readable policy

Date: 2026-06-30

## Status

Accepted

## Context

`public.profiles` carried two SELECT policies: `Profiles are self accessible`
(`auth.uid() = id`) and `Profiles are public` (`using (true)`). The public policy
existed so the legacy leaderboard could read every user's `full_name` /
`university`. The leaderboard was retired in US-RAG-015, but the public policy
remained — meaning any signed-in user (and, since PostgREST also exposes `anon`,
any visitor) could `select *` from `profiles` and read **every** user's `email`,
`full_name`, `university`, and **credit balance**.

A live check confirmed the exposure: under the `authenticated` role, a user could
read all 5 profile rows; nothing in the app relies on that (the dashboard reads
its own row by id; the Stripe path uses the service-role client, which bypasses
RLS).

## Decision

Drop the `Profiles are public` policy. The only remaining SELECT policy is
`Profiles are self accessible`, so a user can read only their own profile.
Removed from `schema.sql` (new databases) and dropped from existing databases by
`supabase/migrations/0002_tighten_profiles_rls.sql` (a `DROP POLICY`, applied by
the human).

If a future feature (e.g. RAG attempt analytics or a new leaderboard) needs a
*subset* of another user's profile fields, expose those specific columns through
a dedicated view or RPC — never a blanket `using (true)` policy on the
credits-bearing `profiles` table.

## Alternatives Considered

1. **Keep the public policy for a future leaderboard.** Rejected: it leaks email
   and credit balance to everyone, and RLS is row-level (it cannot hide the
   sensitive columns). A scoped view is the correct tool if/when needed.
2. **Replace it with a column-restricted policy.** Not possible — Postgres RLS
   filters rows, not columns; column exposure is a view/grant concern.

## Consequences

Positive: profile PII + credit balances are owner-only; the exposure is closed.

Tradeoffs: any later feature needing cross-user profile fields must add a scoped
view/RPC rather than reading `profiles` directly. Verified that the only
user-session reader (the dashboard self-read) still works after the drop.
