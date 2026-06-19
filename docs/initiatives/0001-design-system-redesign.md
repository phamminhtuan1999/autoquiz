# Initiative 0001 — AutoQuiz Design-System Redesign

Date: 2026-06-19

## Source

- User prompt: "read DESIGN.md … add tasks by harness then redesign the UI based
  on DESIGN.md" (2026-06-19). Scope confirmed: full P0–P3 roadmap, visual-only
  (no roles yet), adopt HeroUI (replace clay), keep & restyle existing modes.
- Attached file: `DESIGN.md` (AutoQuiz — Design System v1.0, Proposal).
- External references: NotebookLM, Quizlet, Gamma/Canva Docs (per DESIGN.md).

## Project Summary

Re-skin and re-shape AutoQuiz from a playful clay/neumorphic, gamified quiz app
into the DESIGN.md "premium modern study studio": calm warm-paper surfaces, a
single indigo accent + amber spark, HeroUI components, and a signature
source-grounded review studio. Two surfaces share one token system: a dense
teacher console and a calm student studio. This initiative covers the full
DESIGN.md roadmap (P0–P3), but the first pass is visual-only; roles, the
review-to-publish gate, and the source/confidence data model are recorded and
deferred behind a future authorization decision.

## Candidate Product Docs

Create per-epic, when the epic is sliced — not up front.

| File | Purpose | Source sections |
| --- | --- | --- |
| `docs/product/design-system.md` | Tokens, type, component contract (or formalize DESIGN.md) | DESIGN.md §3–5 |
| `docs/product/review-studio.md` | Source-grounded review behavior | DESIGN.md §8 |
| `docs/product/teacher-surface.md` | Dense teacher console + analytics | DESIGN.md §6, §10 |
| `docs/product/student-surface.md` | Calm student studio + quiz player | DESIGN.md §6, §9 |

## Candidate Epics

| Epic | Description | Phase | Lane | Status |
| --- | --- | --- | --- | --- |
| E01 | Design foundation: tokens, fonts, HeroUI theme, retire clay | P0 | normal | sliced |
| E02 | Primitives + AutoQuiz composites | P0 | normal | sliced |
| E03 | Generation wizard + upload | P0 | normal | sliced |
| E04 | Source-grounded review studio (visual; data-model deferred) | P0 | normal/high-risk | sliced |
| E05 | Teacher console shell + review queue (visual) | P0/P2 | normal | sliced |
| E06 | Student studio home (calm) | P1 | normal | sliced |
| E07 | Quiz player, flashcards, results | P1 | normal | sliced |
| E08 | Landing page redesign | P1 | normal | sliced |
| E09 | Existing modes restyle (cram / mock-exam / leaderboard / credits) | P1 | normal | sliced |
| E10 | Teacher analytics (Tremor/Recharts) | P2 | normal | unsliced |
| E11 | Roles, classes/rosters, mastery, export (auth) | P2 | high-risk | deferred |
| E12 | Optional live engagement | P3 | high-risk | deferred |

## Architecture Questions

- Runtime stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.
- New UI deps: HeroUI (+ heroui plugin), Tiptap (editing), Tremor/Recharts
  (analytics), TanStack Table (banks/results), React Bits (landing motion only).
- Product surfaces: browser only.
- Storage/providers: Supabase (auth/db), Stripe (credits), Google Gemini
  (generation) — unchanged by this initiative.
- Security model: roles deferred; first pass keeps the current single-user flow.
  A teacher/student authorization decision is required before E11.

## Validation Shape

| Layer | Expected proof |
| --- | --- |
| Unit | Token/theme + composite component render tests (when a test runner is added). |
| Integration | Wizard → generate → review flow renders; existing Supabase/Stripe/Gemini flows unbroken. |
| E2E | Upload → generate → review → take-quiz happy path; landing renders. |
| Platform | `next build` succeeds; no clay/gradient regressions. |
| Release | Visual QA of both surfaces in light + dark. |

No validation scripts exist yet; do not claim them until added (see HARNESS.md
"Future Validation Ladder").

## Open Decisions

- 0008 Adopt HeroUI + design system — Accepted (this initiative).
- Teacher/student roles + authorization — REQUIRED before E11 (deferred).
- Whether to formalize `DESIGN.md` into `docs/product/design-system.md` or keep
  it as the source spec.
- HeroUI ↔ Tailwind v4 / React 19 / Next 16 compatibility — resolve in US-003.

## First Story Candidates

- US-001 Design tokens (CSS variables).
- US-002 Typography (Sora / Plus Jakarta Sans / Geist Mono).
- US-003 Adopt HeroUI (provider + plugin + token mapping; compat spike).
- US-004 Retire clay/neumorphic + gradient background.

## Harness Delta

- Decision 0008 recorded.
- Stories US-001…US-027 registered in the durable layer.
- Backlog: HeroUI compat risk; new UI deps; deferred roles decision.
- This initiative note is the durable home for the P0–P3 roadmap (no monolithic
  spec extension, per HARNESS.md).
