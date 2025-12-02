-- Profiles table stores auth-linked metadata and credit balance.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  credits integer not null default 3,
  created_at timestamptz not null default now()
);

-- Maintain profile rows when new auth users register.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Quizzes generated per user with Gemini output stored as JSON.
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  source_filename text,
  questions jsonb not null,
  created_at timestamptz not null default now()
);

-- Track processed Stripe checkout sessions to guarantee idempotent credits.
create table if not exists public.payment_events (
  session_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  source text not null check (source in ('webhook', 'success')),
  created_at timestamptz not null default now()
);

-- Helper RPCs to mutate credits atomically.
create or replace function public.add_credits(p_user_id uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id;
end;
$$;

create or replace function public.deduct_credit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set credits = credits - 1
  where id = p_user_id
  and credits > 0;

  if not found then
    raise exception 'Insufficient credits';
  end if;
end;
$$;

create or replace function public.deduct_credits(p_user_id uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set credits = credits - p_amount
  where id = p_user_id
  and credits >= p_amount;

  if not found then
    raise exception 'Insufficient credits';
  end if;
end;
$$;

-- Enforce per-user visibility via RLS.
alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.payment_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Profiles are self accessible'
  ) then
    create policy "Profiles are self accessible"
      on public.profiles
      for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Profiles update self'
  ) then
    create policy "Profiles update self"
      on public.profiles
      for update
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quizzes'
      and policyname = 'Users see own quizzes'
  ) then
    create policy "Users see own quizzes"
      on public.quizzes
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quizzes'
      and policyname = 'Users insert own quizzes'
  ) then
    create policy "Users insert own quizzes"
      on public.quizzes
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quizzes'
      and policyname = 'Users delete own quizzes'
  ) then
    create policy "Users delete own quizzes"
      on public.quizzes
      for delete
      using (auth.uid() = user_id);
  end if;
end;
$$;

