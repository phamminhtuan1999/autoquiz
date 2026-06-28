# Validation

## Proof Strategy

The web app has no unit harness (consistent with US-RAG-008b); the slice is
proven by a type check plus live browser verification on the test account
against live Supabase + the running AI worker — the same evidence model as
US-RAG-008b. The generalized action/control must not regress the regular path,
so the regular trigger is exercised alongside the cram one.

## Test Plan

| Layer | Cases |
| --- | --- |
| Types | `cd apps/web && npx tsc --noEmit -p tsconfig.json` passes — the `mode` param on the action + control and the `RagCramPlayer` props type-check. |
| Manual / E2E (browser) | On a ready document: (1) "Generate cram" enqueues a `generate_cram` job; the control shows progress then a "Study cram" link. (2) The link opens the cram player: cards flip front→back, each shows a `SourceRef` (page + excerpt), "Got it"/"Still learning" advances. (3) Studying records a `rag_question_attempts` row (`selected_option_id=null`, `is_correct` = rating) — confirmed in the DB. (4) The regular "Generate quiz" trigger + MCQ player still work (no regression). |
| Platform | `apps/web` builds; the player route renders cram and regular sets by `mode`; no console errors. |
| Logs/Audit | The cram `ai_jobs` row carries `job_type=generate_cram`; the attempt write is best-effort (warns, never blocks). |

## Fixtures

- Test account `phamminhtuan1999@gmail.com` (preview verification).
- A ready, indexed document owned by the test account (or upload + process one).
- The AI worker running against live Supabase + Gemini to claim the cram job.

## Commands

```text
cd apps/web && npx tsc --noEmit -p tsconfig.json
# Browser: generate cram on a ready document, study cards, confirm attempts.
```

## Acceptance Evidence

Verified 2026-06-27.

- **Types**: `cd apps/web && npx tsc --noEmit -p tsconfig.json` → **No errors
  found**. The `mode` param on the action + control and the `RagCramPlayer`
  props type-check; the regular caller compiles unchanged.
- **E2E (live browser, test account, dev server on :3000, live Supabase + the
  AI worker)**: signed in as the test account, seeded a ready document + 3
  chunks. (1) The ready document showed **both** triggers — "Generate quiz"
  (Sparkles) and "Generate cram" (Layers). (2) Clicking "Generate cram"
  enqueued a `generate_cram` `ai_jobs` row (status `queued`) and the control
  showed "Generating cram…". (3) Running the worker once produced a `quiz_set`
  mode `cram` ("10-card cram (medium)", 10 `type='flashcard'` questions); the
  control polled to success and rendered a **"Study cram"** link. (4) The link
  opened the cram player: eyebrow "SOURCE-GROUNDED CRAM", "Card 1 of 10", a
  Medium chip, a topic, a `p.1` `SourceRef`, and the flip card. (5) Flipping
  revealed the back ("Photosynthesis converts light energy into chemical
  energy.") plus "Still learning" / "Got it". (6) "Got it" advanced to "Card 2
  of 10" / "1/10 studied" and recorded one `rag_question_attempts` row
  (`selected_option_id=null`, `is_correct=true`). (7) No console errors (no
  best-effort-write overlay regression). **Regression probe**: the regular
  "Generate quiz" trigger still enqueued a `generate_regular_quiz` job — the
  generalized action/control did not regress the regular path. Fixtures torn
  down (cascade).
- **Platform**: `apps/web` dev server compiled and served the cram + regular
  player routes by `quiz_sets.mode`; no console errors during the flow.
- **Deferred (agreed)**: retiring the legacy `generate-cram.ts` /
  `/dashboard/cram` flow → a later cutover step now that this path exists.
