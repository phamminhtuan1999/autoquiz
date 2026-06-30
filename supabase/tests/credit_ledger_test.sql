-- US-RAG-011 credit-ledger verification (manual, against a Supabase DB).
--
-- Run with:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/credit_ledger_test.sql
--
-- It is fully isolated: everything runs inside ONE transaction that ends in
-- ROLLBACK, so no row — not even the throwaway auth user — persists. Any failed
-- assertion raises and aborts. There is no SQL test runner in CI (CI has no
-- database), so this script is the repeatable proof for the ledger + the
-- service-role authorization lockdown.
\set ON_ERROR_STOP on
begin;

-- 1) Signup: inserting an auth user fires handle_new_user -> profile (credits=3)
--    + a 'signup_grant' ledger row.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000aa', 'ledger-test@example.com',
        '{"full_name":"Ledger Test"}'::jsonb);

do $$
declare v_credits int; v_amt int; v_bal int; v_reason text;
begin
  select credits into v_credits from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  if v_credits <> 3 then raise exception 'FAIL signup: expected 3 credits, got %', v_credits; end if;
  select amount, balance_after, reason into v_amt, v_bal, v_reason
  from public.credit_transactions where user_id = '00000000-0000-0000-0000-0000000000aa';
  if v_amt <> 3 or v_bal <> 3 or v_reason <> 'signup_grant' then
    raise exception 'FAIL signup ledger: amt=% bal=% reason=%', v_amt, v_bal, v_reason; end if;
  raise notice 'OK signup_grant: credits=3, ledger(+3, balance_after=3, signup_grant)';
end $$;

-- 2) Purchase: add_credits(+10) -> 13, ledger 'purchase' (+10, balance_after 13).
do $$
declare v_credits int; v_bal int;
begin
  perform public.add_credits('00000000-0000-0000-0000-0000000000aa', 10);
  select credits into v_credits from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  if v_credits <> 13 then raise exception 'FAIL purchase: expected 13, got %', v_credits; end if;
  select balance_after into v_bal from public.credit_transactions
   where user_id = '00000000-0000-0000-0000-0000000000aa' and reason = 'purchase' and amount = 10;
  if v_bal is null or v_bal <> 13 then raise exception 'FAIL purchase ledger: balance_after=%', v_bal; end if;
  raise notice 'OK purchase: credits=13, ledger(+10, balance_after=13, purchase)';
end $$;

-- 3) Spend (RAG): spend_credits(5) -> returns 8, ledger -5 reason job_type ref ai_job.
do $$
declare v_ret int; v_credits int; v_bal int; v_ref text;
begin
  v_ret := public.spend_credits('00000000-0000-0000-0000-0000000000aa', 5, 'generate_mock_exam');
  if v_ret <> 8 then raise exception 'FAIL spend return: expected 8, got %', v_ret; end if;
  select credits into v_credits from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  if v_credits <> 8 then raise exception 'FAIL spend balance: expected 8, got %', v_credits; end if;
  select balance_after, ref_type into v_bal, v_ref
   from public.credit_transactions where user_id = '00000000-0000-0000-0000-0000000000aa'
   and reason = 'generate_mock_exam' and amount = -5;
  if v_bal is null or v_bal <> 8 or v_ref <> 'ai_job' then
    raise exception 'FAIL spend ledger: balance_after=% ref=%', v_bal, v_ref; end if;
  raise notice 'OK spend: returns 8, credits=8, ledger(-5, balance_after=8, generate_mock_exam, ai_job)';
end $$;

-- 4) Insufficient: spend_credits(100) must raise and leave the balance untouched,
--    writing no ledger row.
do $$
declare v_before int; v_after int; v_rows_before bigint; v_rows_after bigint; v_caught boolean := false;
begin
  select credits into v_before from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  select count(*) into v_rows_before from public.credit_transactions where user_id = '00000000-0000-0000-0000-0000000000aa';
  begin
    perform public.spend_credits('00000000-0000-0000-0000-0000000000aa', 100, 'generate_mock_exam');
  exception when others then v_caught := true;
  end;
  select credits into v_after from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  select count(*) into v_rows_after from public.credit_transactions where user_id = '00000000-0000-0000-0000-0000000000aa';
  if not v_caught then raise exception 'FAIL insufficient: spend did not raise'; end if;
  if v_before <> v_after then raise exception 'FAIL insufficient: balance moved % -> %', v_before, v_after; end if;
  if v_rows_before <> v_rows_after then raise exception 'FAIL insufficient: ledger row written on a blocked spend'; end if;
  raise notice 'OK insufficient: spend_credits(100) raised, balance stayed %, no ledger row', v_after;
end $$;

-- 5) Refund: refund_credits(5) -> 13, ledger 'refund' (+5, balance_after 13).
do $$
declare v_credits int; v_bal int;
begin
  perform public.refund_credits('00000000-0000-0000-0000-0000000000aa', 5);
  select credits into v_credits from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  if v_credits <> 13 then raise exception 'FAIL refund: expected 13, got %', v_credits; end if;
  select balance_after into v_bal from public.credit_transactions
   where user_id = '00000000-0000-0000-0000-0000000000aa' and reason = 'refund' and amount = 5;
  if v_bal is null or v_bal <> 13 then raise exception 'FAIL refund ledger: balance_after=%', v_bal; end if;
  raise notice 'OK refund: credits=13, ledger(+5, balance_after=13, refund)';
end $$;

-- 6) Consistency: profiles.credits == sum(amount), and exactly 4 ledger rows
--    (signup, purchase, spend, refund — the blocked spend wrote none).
do $$
declare v_credits int; v_sum int; v_rows bigint;
begin
  select credits into v_credits from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  select coalesce(sum(amount),0) into v_sum from public.credit_transactions
   where user_id = '00000000-0000-0000-0000-0000000000aa';
  select count(*) into v_rows from public.credit_transactions
   where user_id = '00000000-0000-0000-0000-0000000000aa';
  if v_credits <> v_sum then
    raise exception 'FAIL consistency: credits=% <> sum(amount)=%', v_credits, v_sum; end if;
  if v_rows <> 4 then raise exception 'FAIL consistency: expected 4 ledger rows, got %', v_rows; end if;
  raise notice 'OK consistency: profiles.credits=% == sum(amount), 4 ledger rows', v_credits;
end $$;

-- 7) Authorization: the privileged credit RPCs must be denied to the
--    authenticated role (PostgREST runs user requests as this role via SET ROLE)
--    and retained for service_role.
set local role authenticated;
do $$
begin
  begin perform public.add_credits('00000000-0000-0000-0000-0000000000aa', 1);
    raise exception 'SECURITY FAIL: authenticated CALLED add_credits';
  exception when insufficient_privilege then raise notice 'OK: add_credits denied to authenticated';
  end;
  begin perform public.spend_credits('00000000-0000-0000-0000-0000000000aa', 1, 'x');
    raise exception 'SECURITY FAIL: authenticated CALLED spend_credits';
  exception when insufficient_privilege then raise notice 'OK: spend_credits denied to authenticated';
  end;
  begin perform public.refund_credits('00000000-0000-0000-0000-0000000000aa', 1);
    raise exception 'SECURITY FAIL: authenticated CALLED refund_credits';
  exception when insufficient_privilege then raise notice 'OK: refund_credits denied to authenticated';
  end;
end $$;
reset role;
do $$
begin
  if has_function_privilege('service_role', 'public.spend_credits(uuid,int,text,uuid)', 'EXECUTE')
   and has_function_privilege('service_role', 'public.add_credits(uuid,int)', 'EXECUTE')
   and has_function_privilege('service_role', 'public.refund_credits(uuid,int,uuid)', 'EXECUTE') then
    raise notice 'OK: service_role retains EXECUTE on add/spend/refund';
  else
    raise exception 'SECURITY FAIL: service_role lost EXECUTE';
  end if;
end $$;

rollback;
