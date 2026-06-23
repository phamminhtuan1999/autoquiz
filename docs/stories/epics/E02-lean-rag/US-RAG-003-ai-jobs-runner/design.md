# Design

## Domain Model

`AiJob` represents one durable backend task owned by a user. Job types remain:

- `process_document`
- `generate_regular_quiz`
- `generate_cram`
- `generate_study_review`
- `generate_mock_exam`

Statuses remain `queued`, `running`, `succeeded`, `failed`, and `cancelled`.
The runner adds lock metadata:

- `locked_by`: worker identifier that currently owns a running job.
- `attempt_count`: number of claims attempted.
- `max_attempts`: retry budget.

## Application Flow

1. Worker calls `claim_ai_job`.
2. Postgres atomically selects one queued or stale running job using
   `for update skip locked`.
3. Postgres marks it `running`, sets `locked_by`, refreshes `locked_at`, and
   increments `attempt_count`.
4. Python dispatches to a handler by `job_type`.
5. Python calls `complete_ai_job` on success.
6. Python calls `fail_ai_job` on handler errors.
7. Retryable failure requeues the job while attempts remain; non-retryable or
   exhausted jobs become `failed`.

## Interface Contract

Supabase RPCs:

- `claim_ai_job(p_worker_id, p_job_types, p_lock_timeout)`
- `update_ai_job_progress(p_job_id, p_worker_id, p_progress, p_current_step)`
- `complete_ai_job(p_job_id, p_worker_id, p_output)`
- `fail_ai_job(p_job_id, p_worker_id, p_error_message, p_retryable, p_output)`

All lifecycle RPCs require `auth.role() = 'service_role'`.

Python command:

```bash
PYTHONPATH=apps/ai python3 apps/ai/run_once.py
```

Until at least one concrete handler is implemented by a later story,
`run_once.py` exits with `{"status": "not_configured"}` and does not claim live
jobs.

Environment:

- `AUTOQUIZ_AI_SUPABASE_URL`
- `AUTOQUIZ_AI_SUPABASE_SERVICE_ROLE_KEY`
- `AUTOQUIZ_AI_WORKER_ID`
- `AUTOQUIZ_AI_JOB_TYPES_CSV` optional comma-separated claim filter

## Data Model

`public.ai_jobs` adds `locked_by`, `attempt_count`, and `max_attempts`.

`ai_jobs_claimable_idx` supports queued/stale-running claim scans.

## UI / Platform Impact

No browser UI changes. Platform impact is limited to Python worker
configuration and future deployment of `apps/ai`.

## Observability

Job rows record status, progress, current step, error message, lock owner,
attempt count, timestamps, input, and output. The worker currently prints a
single JSON line for idle or claimed outcomes.

## Alternatives Considered

1. Application-side select/update claiming. Rejected for race risk.
2. Redis/Celery. Deferred until job volume requires it.
