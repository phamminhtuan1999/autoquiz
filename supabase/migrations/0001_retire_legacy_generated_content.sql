-- US-RAG-015: retire legacy generated-content tables (clean cutover).
--
-- Apply once to an existing database AFTER deploying the web cutover (the legacy
-- routes/actions that read or wrote these tables are removed). Run with:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_retire_legacy_generated_content.sql
--
-- This is INTENTIONALLY DESTRUCTIVE: generated quiz / cram / mock-exam history is
-- discarded, not migrated (decision 0010, docs/product/rag-clean-cutover.md — the
-- human confirmed old generated history does not need to be preserved). It does
-- NOT touch accounts or billing: public.profiles (incl. credits),
-- public.payment_events (Stripe idempotency), auth.users, and the
-- credit_transactions ledger + add_credits/spend_credits/refund_credits RPCs are
-- all preserved. New databases never create these tables (schema.sql no longer
-- defines them), so this migration is a no-op there.
--
-- Idempotent: safe to re-run.

begin;

-- question_attempts has an FK to quizzes; drop it first (cascade also covers it).
drop table if exists public.question_attempts cascade;
drop table if exists public.quizzes cascade;
drop table if exists public.mock_exams cascade;

-- The legacy single/multi-credit spend RPCs are unused after the cutover (the
-- legacy generate actions that called them are removed). Credit spend now goes
-- through spend_credits (RAG) and grants through add_credits (Stripe), which are
-- preserved. Drop the retired helpers.
drop function if exists public.deduct_credit(uuid);
drop function if exists public.deduct_credits(uuid, int);

commit;
