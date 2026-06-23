-- Profiles table stores auth-linked metadata and credit balance.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  university text,
  credits integer not null default 3,
  created_at timestamptz not null default now()
);

-- Add university column if it doesn't exist (migrations for existing tables)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'university') then
    alter table public.profiles add column university text;
  end if;
end $$;

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


-- Lean RAG MVP foundation (additive; legacy generated-content tables remain
-- until replacement flows are released and a later cleanup migration retires
-- them explicitly).
create extension if not exists vector with schema extensions;

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documents', 'documents', false, 31457280, array['application/pdf'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when undefined_table then
    raise notice 'Supabase storage schema is unavailable; skipping documents bucket bootstrap.';
end;
$$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  original_filename text,
  storage_path text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  page_count integer check (page_count is null or page_count between 0 and 150),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed', 'unsupported')),
  embedding_provider text,
  embedding_model text,
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, storage_path)
);

create table if not exists public.document_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  page_number integer not null check (page_number > 0),
  raw_text text,
  cleaned_text text,
  char_count integer check (char_count is null or char_count >= 0),
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  page_start integer check (page_start is null or page_start > 0),
  page_end integer check (page_end is null or page_end > 0),
  heading text,
  content text not null,
  token_count integer check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  check (page_end is null or page_start is null or page_end >= page_start)
);

create table if not exists public.chunk_embeddings_openai (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  chunk_id uuid not null references public.document_chunks (id) on delete cascade,
  provider text not null default 'openai' check (provider = 'openai'),
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (chunk_id, provider, model)
);

create table if not exists public.chunk_embeddings_gemini (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  chunk_id uuid not null references public.document_chunks (id) on delete cascade,
  provider text not null default 'gemini' check (provider = 'gemini'),
  model text not null,
  embedding vector(3072) not null,
  created_at timestamptz not null default now(),
  unique (chunk_id, provider, model)
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_type text not null
    check (job_type in (
      'process_document',
      'generate_regular_quiz',
      'generate_cram',
      'generate_study_review',
      'generate_mock_exam'
    )),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  current_step text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  locked_at timestamptz,
  locked_by text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_jobs
  add column if not exists locked_by text;
alter table public.ai_jobs
  add column if not exists attempt_count integer not null default 0;
alter table public.ai_jobs
  add column if not exists max_attempts integer not null default 3;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_jobs_attempt_count_check'
      and conrelid = 'public.ai_jobs'::regclass
  ) then
    alter table public.ai_jobs
      add constraint ai_jobs_attempt_count_check check (attempt_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_jobs_max_attempts_check'
      and conrelid = 'public.ai_jobs'::regclass
  ) then
    alter table public.ai_jobs
      add constraint ai_jobs_max_attempts_check check (max_attempts > 0);
  end if;
end;
$$;

create table if not exists public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  job_id uuid references public.ai_jobs (id) on delete set null,
  mode text not null check (mode in ('regular', 'cram', 'study_review', 'mock')),
  title text not null,
  difficulty text,
  status text not null default 'ready'
    check (status in ('draft', 'ready', 'in_progress', 'completed', 'failed', 'retired')),
  credit_cost integer not null default 0 check (credit_cost >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quiz_set_id uuid not null references public.quiz_sets (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  source_chunk_id uuid references public.document_chunks (id) on delete set null,
  type text not null check (type in ('mcq', 'short_answer', 'essay', 'flashcard')),
  difficulty text,
  topic text,
  prompt text not null,
  correct_answer text,
  explanation text,
  source_page_start integer check (source_page_start is null or source_page_start > 0),
  source_page_end integer check (source_page_end is null or source_page_end > 0),
  source_excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    source_page_end is null
    or source_page_start is null
    or source_page_end >= source_page_start
  )
);

create table if not exists public.answer_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null,
  content text not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, label)
);

-- Legacy public.question_attempts remains in place during clean cutover.
-- RAG attempts use a separate table until the legacy table can be retired.
create table if not exists public.rag_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  quiz_set_id uuid not null references public.quiz_sets (id) on delete cascade,
  selected_option_id uuid references public.answer_options (id) on delete set null,
  answer_text text,
  is_correct boolean,
  time_spent_ms integer check (time_spent_ms is null or time_spent_ms >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.study_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quiz_set_id uuid references public.quiz_sets (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  summary jsonb not null,
  weak_topics jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_status_idx
  on public.documents (user_id, status, created_at desc);
create index if not exists document_pages_document_page_idx
  on public.document_pages (document_id, page_number);
create index if not exists document_chunks_document_chunk_idx
  on public.document_chunks (document_id, chunk_index);
create index if not exists document_chunks_user_document_idx
  on public.document_chunks (user_id, document_id);
create index if not exists chunk_embeddings_openai_chunk_idx
  on public.chunk_embeddings_openai (chunk_id);
create index if not exists chunk_embeddings_gemini_chunk_idx
  on public.chunk_embeddings_gemini (chunk_id);
create index if not exists ai_jobs_status_created_idx
  on public.ai_jobs (status, created_at);
create index if not exists ai_jobs_user_status_idx
  on public.ai_jobs (user_id, status, created_at desc);
create index if not exists ai_jobs_claimable_idx
  on public.ai_jobs (status, created_at, locked_at)
  where status in ('queued', 'running');
create index if not exists quiz_sets_user_mode_idx
  on public.quiz_sets (user_id, mode, created_at desc);
create index if not exists questions_quiz_set_idx
  on public.questions (quiz_set_id);
create index if not exists answer_options_question_idx
  on public.answer_options (question_id);
create index if not exists rag_question_attempts_user_quiz_set_idx
  on public.rag_question_attempts (user_id, quiz_set_id, created_at desc);
create index if not exists study_reviews_user_document_idx
  on public.study_reviews (user_id, document_id, created_at desc);

create index if not exists chunk_embeddings_openai_embedding_idx
  on public.chunk_embeddings_openai
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- No ANN index on chunk_embeddings_gemini: its embedding is vector(3072), and
-- pgvector's ivfflat/hnsw indexes cap at 2000 dimensions. The Gemini table is a
-- development / full-document fallback, so exact (sequential) cosine search is
-- acceptable here. When the Gemini retrieval path is built (US-RAG-006), switch
-- this column to halfvec(3072) (hnsw supports up to 4000 dims) and index it then.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at
before update on public.documents
for each row execute procedure public.touch_updated_at();

drop trigger if exists ai_jobs_touch_updated_at on public.ai_jobs;
create trigger ai_jobs_touch_updated_at
before update on public.ai_jobs
for each row execute procedure public.touch_updated_at();

create or replace function public.match_document_chunks_openai(
  query_embedding vector(1536),
  match_count integer,
  p_document_id uuid,
  p_user_id uuid
)
returns table (
  chunk_id uuid,
  content text,
  page_start integer,
  page_end integer,
  similarity double precision
)
language sql
stable
-- extensions: the pgvector type/operators (<=>) live in the extensions schema
set search_path = public, extensions
as $$
  select
    dc.id as chunk_id,
    dc.content,
    dc.page_start,
    dc.page_end,
    1 - (ce.embedding <=> query_embedding) as similarity
  from public.chunk_embeddings_openai ce
  join public.document_chunks dc on dc.id = ce.chunk_id
  where dc.user_id = p_user_id
    and dc.document_id = p_document_id
  order by ce.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

create or replace function public.match_document_chunks_gemini(
  query_embedding vector(3072),
  match_count integer,
  p_document_id uuid,
  p_user_id uuid
)
returns table (
  chunk_id uuid,
  content text,
  page_start integer,
  page_end integer,
  similarity double precision
)
language sql
stable
-- extensions: the pgvector type/operators (<=>) live in the extensions schema
set search_path = public, extensions
as $$
  select
    dc.id as chunk_id,
    dc.content,
    dc.page_start,
    dc.page_end,
    1 - (ce.embedding <=> query_embedding) as similarity
  from public.chunk_embeddings_gemini ce
  join public.document_chunks dc on dc.id = ce.chunk_id
  where dc.user_id = p_user_id
    and dc.document_id = p_document_id
  order by ce.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

create or replace function public.assert_service_role()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.claim_ai_job(
  p_worker_id text,
  p_job_types text[] default null,
  p_lock_timeout interval default interval '15 minutes'
)
returns table (
  id uuid,
  user_id uuid,
  job_type text,
  status text,
  progress integer,
  current_step text,
  input jsonb,
  output jsonb,
  error_message text,
  locked_at timestamptz,
  locked_by text,
  attempt_count integer,
  max_attempts integer,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_service_role();

  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required'
      using errcode = '22023';
  end if;

  return query
  with candidate as (
    select j.id
    from public.ai_jobs j
    where (
        j.status = 'queued'
        or (
          j.status = 'running'
          and j.locked_at < now() - p_lock_timeout
        )
      )
      and j.attempt_count < j.max_attempts
      and (p_job_types is null or j.job_type = any(p_job_types))
    order by j.created_at, j.id
    for update skip locked
    limit 1
  )
  update public.ai_jobs j
  set status = 'running',
      progress = case when j.status = 'queued' then 0 else j.progress end,
      current_step = 'claimed',
      locked_at = now(),
      locked_by = p_worker_id,
      attempt_count = j.attempt_count + 1,
      started_at = coalesce(j.started_at, now()),
      finished_at = null,
      error_message = null
  from candidate
  where j.id = candidate.id
  returning
    j.id,
    j.user_id,
    j.job_type,
    j.status,
    j.progress,
    j.current_step,
    j.input,
    j.output,
    j.error_message,
    j.locked_at,
    j.locked_by,
    j.attempt_count,
    j.max_attempts,
    j.started_at,
    j.finished_at,
    j.created_at,
    j.updated_at;
end;
$$;

create or replace function public.update_ai_job_progress(
  p_job_id uuid,
  p_worker_id text,
  p_progress integer,
  p_current_step text default null
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.ai_jobs;
begin
  perform public.assert_service_role();

  update public.ai_jobs
  set progress = least(greatest(p_progress, 0), 100),
      current_step = coalesce(p_current_step, current_step),
      locked_at = now()
  where id = p_job_id
    and status = 'running'
    and locked_by = p_worker_id
  returning * into updated_job;

  if updated_job.id is null then
    raise exception 'running job lock not found'
      using errcode = 'P0002';
  end if;

  return updated_job;
end;
$$;

create or replace function public.complete_ai_job(
  p_job_id uuid,
  p_worker_id text,
  p_output jsonb default '{}'::jsonb
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.ai_jobs;
begin
  perform public.assert_service_role();

  update public.ai_jobs
  set status = 'succeeded',
      progress = 100,
      current_step = 'completed',
      output = coalesce(p_output, '{}'::jsonb),
      error_message = null,
      locked_at = null,
      locked_by = null,
      finished_at = now()
  where id = p_job_id
    and status = 'running'
    and locked_by = p_worker_id
  returning * into updated_job;

  if updated_job.id is null then
    raise exception 'running job lock not found'
      using errcode = 'P0002';
  end if;

  return updated_job;
end;
$$;

create or replace function public.fail_ai_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_message text,
  p_retryable boolean default true,
  p_output jsonb default '{}'::jsonb
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.ai_jobs;
begin
  perform public.assert_service_role();

  update public.ai_jobs
  set status = case
        when p_retryable and attempt_count < max_attempts then 'queued'
        else 'failed'
      end,
      current_step = case
        when p_retryable and attempt_count < max_attempts then 'queued_retry'
        else 'failed'
      end,
      output = coalesce(p_output, output),
      error_message = left(coalesce(p_error_message, 'job failed'), 2000),
      locked_at = null,
      locked_by = null,
      finished_at = case
        when p_retryable and attempt_count < max_attempts then null
        else now()
      end
  where id = p_job_id
    and status = 'running'
    and locked_by = p_worker_id
  returning * into updated_job;

  if updated_job.id is null then
    raise exception 'running job lock not found'
      using errcode = 'P0002';
  end if;

  return updated_job;
end;
$$;

alter table public.documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chunk_embeddings_openai enable row level security;
alter table public.chunk_embeddings_gemini enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.quiz_sets enable row level security;
alter table public.questions enable row level security;
alter table public.answer_options enable row level security;
alter table public.rag_question_attempts enable row level security;
alter table public.study_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and policyname = 'Users manage own documents'
  ) then
    create policy "Users manage own documents"
      on public.documents
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_pages'
      and policyname = 'Users manage own document pages'
  ) then
    create policy "Users manage own document pages"
      on public.document_pages
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_chunks'
      and policyname = 'Users manage own document chunks'
  ) then
    create policy "Users manage own document chunks"
      on public.document_chunks
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chunk_embeddings_openai'
      and policyname = 'Users manage own OpenAI chunk embeddings'
  ) then
    create policy "Users manage own OpenAI chunk embeddings"
      on public.chunk_embeddings_openai
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chunk_embeddings_gemini'
      and policyname = 'Users manage own Gemini chunk embeddings'
  ) then
    create policy "Users manage own Gemini chunk embeddings"
      on public.chunk_embeddings_gemini
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_jobs'
      and policyname = 'Users manage own AI jobs'
  ) then
    create policy "Users manage own AI jobs"
      on public.ai_jobs
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quiz_sets'
      and policyname = 'Users manage own quiz sets'
  ) then
    create policy "Users manage own quiz sets"
      on public.quiz_sets
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'questions'
      and policyname = 'Users manage own questions'
  ) then
    create policy "Users manage own questions"
      on public.questions
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'answer_options'
      and policyname = 'Users manage own answer options'
  ) then
    create policy "Users manage own answer options"
      on public.answer_options
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rag_question_attempts'
      and policyname = 'Users manage own RAG question attempts'
  ) then
    create policy "Users manage own RAG question attempts"
      on public.rag_question_attempts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'study_reviews'
      and policyname = 'Users manage own study reviews'
  ) then
    create policy "Users manage own study reviews"
      on public.study_reviews
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'Users manage own document PDFs'
    ) then
      create policy "Users manage own document PDFs"
        on storage.objects
        for all
        using (
          bucket_id = 'documents'
          and auth.uid()::text = (storage.foldername(name))[1]
        )
        with check (
          bucket_id = 'documents'
          and auth.uid()::text = (storage.foldername(name))[1]
        );
    end if;
  end if;
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

-- Track individual question attempts for leaderboards.
create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  question_index integer not null,
  is_correct boolean not null,
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
alter table public.question_attempts enable row level security;

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
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Profiles are public'
  ) then
    create policy "Profiles are public"
      on public.profiles
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_attempts'
      and policyname = 'Users insert own attempts'
  ) then
    create policy "Users insert own attempts"
      on public.question_attempts
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_attempts'
      and policyname = 'Attempts are public'
  ) then
    create policy "Attempts are public"
      on public.question_attempts
      for select
      using (true);
  end if;
end;
$$;



-- Mock Exams table for premium comprehensive exams
create table if not exists public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  source_filenames text[] not null,  -- Array of PDF filenames
  time_limit_minutes integer not null default 60,

  -- Exam content (JSONB)
  mcq_questions jsonb not null,      -- 30 MCQs
  essay_questions jsonb not null,    -- 2 Essays with rubrics

  -- Submission tracking
  started_at timestamptz,
  submitted_at timestamptz,
  time_spent_seconds integer,

  -- Results
  mcq_answers jsonb,                 -- User's MCQ answers
  essay_answers jsonb,               -- User's essay responses
  mcq_score integer,                 -- Out of 30
  essay_scores jsonb,                -- AI graded essay scores
  total_score numeric(5,2),          -- Percentage
  feedback jsonb,                    -- AI-generated feedback

  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'submitted', 'graded')),

  created_at timestamptz not null default now()
);

-- RLS policies for mock_exams
alter table public.mock_exams enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mock_exams'
      and policyname = 'Users see own mock exams'
  ) then
    create policy "Users see own mock exams"
      on public.mock_exams
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mock_exams'
      and policyname = 'Users insert own mock exams'
  ) then
    create policy "Users insert own mock exams"
      on public.mock_exams
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mock_exams'
      and policyname = 'Users update own mock exams'
  ) then
    create policy "Users update own mock exams"
      on public.mock_exams
      for update
      using (auth.uid() = user_id);
  end if;
end;
$$;
