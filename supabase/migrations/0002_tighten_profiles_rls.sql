-- US-RAG-017 / decision 0016: tighten profiles RLS.
--
-- Drop the world-readable 'Profiles are public' SELECT policy. It existed only
-- for the legacy leaderboard (retired in US-RAG-015); nothing reads another
-- user's profile via a user session anymore (the dashboard reads its own row by
-- id; the Stripe path uses the service-role client, which bypasses RLS). After
-- this, the only SELECT policy is 'Profiles are self accessible'
-- (auth.uid() = id), so a signed-in user can no longer read other users'
-- profile rows (email, full_name, university, credit balance) over PostgREST.
--
-- Apply with:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_tighten_profiles_rls.sql
--
-- Non-destructive (removes an access rule, not data) and idempotent. Does not
-- touch profile rows, credits, payments, or auth.

drop policy if exists "Profiles are public" on public.profiles;
