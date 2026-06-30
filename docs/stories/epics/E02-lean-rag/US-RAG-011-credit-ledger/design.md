# Design

## Data model

`public.credit_transactions` (append-only):

| Column | Notes |
| --- | --- |
| `id` uuid pk | |
| `user_id` uuid | → `profiles(id)` on delete cascade |
| `amount` int | signed: positive = grant, negative = spend |
| `balance_after` int | `profiles.credits` snapshot after this row |
| `reason` text | `signup_grant` / `purchase` / `refund` / a generation `job_type` |
| `ref_type` text | `ai_job` / `payment_event` / null |
| `ref_id` text | `ai_jobs.id` / `payment_events.session_id` when known |
| `created_at` timestamptz | |

Index `(user_id, created_at desc)`. RLS: `for select using (auth.uid() = user_id)`;
**no** insert/update/delete policy — rows come only from the `SECURITY DEFINER`
RPCs. `profiles.credits` stays the running balance; `ai_jobs` gains
`credit_cost integer not null default 0`.

## RPCs (all `SECURITY DEFINER`, `search_path = public`)

- `add_credits(user, amount)` — unchanged signature; update balance + ledger
  `'purchase'`. Used by `payments.ts` (service-role).
- `spend_credits(user, amount, reason, ref uuid default null) returns int` —
  atomic gate (`credits >= amount` else `raise 'Insufficient credits'`), deduct,
  ledger `(-amount, reason, 'ai_job', ref)`, return new balance. Used by the RAG
  enqueue path. `amount = 0` is a no-op that returns the current balance.
- `refund_credits(user, amount, ref uuid default null)` — add back + ledger
  `'refund'`. Enqueue rollback.
- `deduct_credit(user)` / `deduct_credits(user, n)` — legacy spends; now also
  ledger `'spend'`. Retired in US-RAG-015.
- `handle_new_user()` — also ledgers the signup grant when a profile is created.

## Authorization (hard gate)

Credit mutation is privileged. Revoke `EXECUTE` on `add_credits` /
`spend_credits` / `refund_credits` from `public`/`anon`/`authenticated`; grant to
`service_role` only. The legacy `deduct_credit(s)` keep their grant until
US-RAG-015 removes them. PostgREST runs anon/user requests as the `anon` /
`authenticated` Postgres roles via `SET ROLE`, so revoking `EXECUTE` from those
roles denies the RPC over the API — verified directly with `SET ROLE` (which is
exactly PostgREST's mechanism).

## Application flow

`enqueue-quiz-generation` (server action):

1. Authenticate the user on the session client; resolve the document is `ready`.
2. `cost = CREDIT_COST[mode]` (regular 1, cram 3, mock 5, study_review 1).
3. If `cost > 0`, build the **service-role** admin client and call
   `spend_credits(user.id, cost, jobType)`. On error → return a friendly
   "you don't have enough credits" message; nothing is queued.
4. Insert the `ai_jobs` row with `credit_cost = cost` on the user session client
   (RLS-scoped).
5. If the insert fails → `refund_credits(user.id, cost)` and return the error.

`enqueue-mock-grading` records `credit_cost: 0` (grading is covered by the mock
generation charge). `payments.ts` is unchanged — `add_credits` keeps its
signature and now ledgers `'purchase'`; `payment_events.session_id` idempotency
is untouched.

## Ordering / consistency notes

- The charge is reserved at **enqueue**, not completion, because the worker runs
  asynchronously. `spend_credits` is a single guarded `UPDATE … RETURNING`, so it
  is atomic and never drives the balance negative even under concurrent enqueues
  (the row lock serializes them).
- `balance_after` is a per-row snapshot for human-readable history. Within one DB
  transaction `now()` is constant and `id` is random, so callers must not infer
  ordering from `(created_at, id)` — reconcile against `SUM(amount)` instead.
