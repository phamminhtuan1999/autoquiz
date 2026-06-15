# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run start            # Serve production build
npm run lint             # ESLint (eslint-config-next, flat config)

npm run stripe:listen    # Forward Stripe webhooks to localhost:3000/api/webhooks/stripe (prints whsec_… for STRIPE_WEBHOOK_SECRET)
npm run stripe:trigger   # Fire a test checkout.session.completed event
```

There is **no test framework** configured. The `postinstall` hook copies the pdfjs worker into `public/pdf.worker.min.mjs` — required for client-side PDF parsing to work.

Path alias: `@/*` → `./src/*`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Supabase (auth + Postgres) · Stripe · Google Gemini. The README says "Next.js 14" but the project is on Next 16 — trust `package.json`.

## Architecture

AutoQuiz turns uploaded PDFs into AI-generated study material. Three product surfaces, all credit-gated, all backed by Gemini:

| Feature | Action | Cost | Output |
| --- | --- | --- | --- |
| Quiz | `actions/generate-quiz.ts` | 1 credit | N multiple-choice questions (difficulty: easy/medium/hard/extreme) |
| Cram | `actions/generate-cram.ts` | 3 credits | 10 "golden nugget" summaries + 20 blitz Q&A |
| Mock Exam | `actions/generate-mock-exam.ts` + `mock-exam-session.ts` | 5 credits | 30 MCQs + 2 rubric-graded essays, timed, AI-graded |

### Next.js 16 middleware lives in `src/proxy.ts`

Next 16 renamed the middleware convention: the file is `src/proxy.ts` and it exports a function named `proxy` (not `middleware`). It runs `supabase.auth.getUser()` on every matched request to refresh the auth session cookie. There is **no** `middleware.ts` — don't create one.

### Three Supabase clients — pick by trust boundary

- `lib/supabase/client.ts` (`createSupabaseBrowserClient`) — browser, anon key, RLS enforced.
- `lib/supabase/server.ts` (`createSupabaseServerClient`) — server components / server actions / route handlers, cookie-bound, RLS enforced. **This is the default for anything user-facing.**
- `lib/supabase/server-admin.ts` (`createServiceRoleClient`) — service role key, **bypasses RLS**. Used only where there is no user session, i.e. the Stripe webhook crediting flow in `lib/payments.ts`. Never use this in code reachable from a user request without an explicit ownership check.

### Credit system

`profiles.credits` is the balance; new users get 3 free via the `handle_new_user` trigger on `auth.users` insert. All mutations go through `SECURITY DEFINER` RPCs in `supabase/schema.sql`:
- `deduct_credit(p_user_id)` — subtracts 1 (used by quiz generation).
- `deduct_credits(p_user_id, p_amount)` — subtracts N, raises `Insufficient credits` if balance too low (used by cram/mock-exam).
- `add_credits(p_user_id, p_amount)` — used only by the payment flow.

Actions follow the pattern: auth check → read `profiles.credits` → generate via Gemini → **insert the result, then deduct credits**, and on deduct failure delete the just-inserted row to stay consistent (see `generate-cram.ts` / `generate-mock-exam.ts`).

### Stripe payments

- `api/checkout/route.ts` creates a Checkout Session for 10 credits ($9.90) with `metadata.userId`.
- `api/webhooks/stripe/route.ts` verifies the signature against the **raw request body** (`req.arrayBuffer()`, `runtime = "nodejs"`, `dynamic = "force-dynamic"`) and delegates to `recordCreditsForSession` in `lib/payments.ts`.
- **Idempotency** is enforced by inserting into `payment_events` (primary key = `session_id`) *before* adding credits. A duplicate-key error (`23505`) means "already processed". Credits are only added after the event row commits; if `add_credits` fails the event row is rolled back. The `source` column (`'webhook'` | `'success'`) distinguishes the two entry points (webhook vs. the `?success=1` dashboard redirect).

### Gemini integration

`lib/gemini.ts` does **dynamic model selection**: `getAvailableModel()` calls the Google `models` REST endpoint, picks the first available from a hard-coded preference list (`gemini-3.0-flash`, `gemini-3.0-flash-lite`, …), and caches it for the process. `GEMINI_MODEL` env is only a fallback when the list fetch fails. When updating preferred models, edit the `preferredModels` array there.

Every Gemini call shares the same fragile contract: prompt demands raw JSON, the response is then stripped of ``` / ```json fences and `JSON.parse`'d. Input document text is **truncated to 15,000 chars** per document before sending. If you add a new AI feature, reuse this strip-fences-then-parse pattern and validate the parsed shape (mock-exam validates exact question counts and that `correctAnswer` ∈ `options`).

### PDF extraction is client-side only

`utils/pdf.ts` (`extractTextFromPdf`) runs in the browser via `pdfjs-dist`, using the worker at `/pdf.worker.min.mjs`. Server actions receive already-extracted `documentText` strings, never files. The uploader components (`components/pdf/`, `components/mock-exam/pdf-multi-selector.tsx`) do the extraction.

### Leaderboards & answer tracking

`question_attempts` rows are written client-side by `actions/record-answer.ts` (a `"use client"` module using the browser client, despite the `actions/` location). `actions/get-leaderboard.ts` aggregates the current week's attempts in JS, optionally filtered by `profiles.university`. Note `question_attempts` and `profiles` have permissive "public select" RLS policies so leaderboards can read across users.

### Data model note

The `quizzes` table is reused as generic AI-output storage: its `questions` JSONB column holds either a `QuizQuestion[]` (quiz) or a full `CramResult` (cram). Type definitions live in `src/types/mock-exam.ts` and `src/types/cram.ts`. The schema in `supabase/schema.sql` is idempotent (guarded `create … if not exists` / `do $$ … $$` blocks) and is meant to be re-run wholesale in the Supabase SQL editor.

## Conventions

See `AGENTS.md` for the full style guide. Key points: absolute `@/` imports, `type`-only imports for types, explicit return types, `"use client"` + `useTransition` for async UI, server actions start with `"use server"` and re-check auth + ownership on every call.

`skills/` is excluded from both `tsconfig.json` and ESLint — it is not application code.
