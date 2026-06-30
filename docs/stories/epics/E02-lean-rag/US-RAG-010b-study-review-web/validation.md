# Validation

## Proof Strategy

The web app has no unit harness (consistent with US-RAG-008b/009b/012b); the slice
is proven by a type check plus live browser verification on the test account
against live Supabase + the running AI worker — the same evidence model as the
prior web slices. The generalized action/control/route must not regress the
regular, cram, or mock path, so at least one of those triggers is exercised
alongside the review one.

## Test Plan

| Layer | Cases |
| --- | --- |
| Types | `cd apps/web && npx tsc --noEmit -p tsconfig.json` passes — the `study_review` mode on the action + control and the `RagStudyReview` props type-check; the regular/cram/mock callers compile unchanged. |
| Manual / E2E (browser) | On a ready document **with prior attempts**: (1) "Generate review" enqueues a `generate_study_review` job; the control shows progress then a "View review" link. (2) The link opens the report: the summary text + an attempts/correct/incorrect readout, a weak-topics list (each with why + recommended action + a `SourceRef` page+excerpt), and recommended actions. (3) On a document **with no attempts**, "Generate review" returns the inline "take a quiz first" message and queues nothing. (4) A regular/cram/mock trigger still works (no regression). |
| Platform | `apps/web` builds; the player route renders the review report vs the players by `mode`; no console errors. |
| Logs/Audit | The review `ai_jobs` row carries `job_type=generate_study_review`; the attempts pre-check prevents a doomed/failed job for the no-attempts case. |

## Fixtures

- Test account `phamminhtuan1999@gmail.com` (preview verification).
- A ready, indexed document owned by the test account, plus a few
  `rag_question_attempts` for it (seed a quiz set + questions + attempts, or take
  a quiz in-app first).
- The AI worker running against live Supabase + Gemini to claim the review job.

## Commands

```text
cd apps/web && npx tsc --noEmit -p tsconfig.json
# Browser: seed attempts, generate a review on the document, view the report.
```

## Acceptance Evidence

Verified 2026-06-29.

- **Types**: `cd apps/web && npx tsc --noEmit -p tsconfig.json` → **No errors
  found**. The `study_review` mode on the action + control, the attempts pre-check,
  and the `RagStudyReview` props type-check; the regular/cram/mock callers compile
  unchanged.
- **E2E (live browser, test account, dev server :3000, live Supabase + the AI
  worker on Gemini)**: seeded a ready document with a practice quiz_set + 3 MCQ
  (each cited + topic) and **3 `rag_question_attempts` (1 correct, 2 wrong)**,
  plus a bare ready document (no attempts). (1) Each ready document showed
  **four** triggers — quiz, cram, mock, and "Generate review" (ClipboardList).
  (2) **No-attempts gate**: "Generate review" on the bare document returned the
  inline "Take a quiz on this document first — a study review needs your attempts."
  message and **queued no job**. (3) On the with-attempts document, "Generate
  review" enqueued a `generate_study_review` job; the worker produced a
  `study_reviews` row keyed to a `study_review` quiz_set ("Study review of 3
  attempts") — summary `{attempts_reviewed:3, correct:1, incorrect:2}`, **2 weak
  topics matching exactly the 2 missed questions** ("Photosynthesis — Light
  Reaction Location" cited p.2, "DNA Replication — Lagging Strand Synthesis" cited
  p.3), and 3 recommended actions. (4) The "View review" link opened the report:
  eyebrow "SOURCE-GROUNDED STUDY REVIEW", "3 attempts reviewed", a summary card
  with an accuracy bar ("1/3 correct · 33%"), the two weak-topic cards (each with
  a `why`, a "Try this:" recommended action, and a `SourceRef` page+excerpt
  popover), and a "Recommended next steps" checklist. **No console errors.**
  (Note: the first generation attempt hit a transient Gemini non-JSON response and
  was requeued; the retry succeeded — the runner's retry path, working as
  designed.)
- **Regression**: a sibling "Generate cram" trigger still enqueued a
  `generate_cram` job after the shared action/control changes — the new
  `study_review` mode + attempts gate did not regress the other modes.
- **Platform**: `apps/web` dev server compiled and served the study-review report
  route by `quiz_sets.mode`; no console errors. Fixtures torn down (cascade).
- **Note**: all four RAG modes (regular, cram, mock, study_review) are now usable
  in the UI.
