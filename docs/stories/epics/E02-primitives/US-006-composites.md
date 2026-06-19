# US-006 Build AutoQuiz composite components

## Status

implemented

## Lane

normal

## Product Contract

All DESIGN.md §5 AutoQuiz composites exist as typed React components, each
built on HeroUI primitives and DESIGN.md CSS-variable tokens. They are
importable from `@/components/quiz/composites`.

## Relevant Product Docs

- `DESIGN.md` §5 Component mapping — AutoQuiz → HeroUI
- `DESIGN.md` §3 Design tokens (confidence/difficulty thresholds)

## Acceptance Criteria

- `DifficultyChip` — Easy (green), Medium (amber), Hard (violet #7c3aed). Token-styled span.
- `StatusChip` — drafted/needs-review/approved/rejected. HeroUI Chip, color prop mapped.
- `ConfidenceMeter` — HeroUI ProgressBar + Geist Mono % label; color thresholds ≥85 green, 60–84 amber, <60 rose.
- `SourceRef` — HeroUI Popover; citation chip opens passage + page number.
- `ReviewBar` — Approve (primary), Edit (outline), Regenerate (ghost), Reject (danger-soft).
- `QuestionCard` — HeroUI Card; Header = chips + confidence; Body = stem + options + explanation; Footer = ReviewBar when `mode="review"`.
- `EmptyState` — heading, description, optional icon and action button.
- `next build` exits 0.

## Design Notes

- Hard difficulty uses violet `#7c3aed` (DESIGN.md spec) — no HeroUI Chip `color`
  maps to violet, so it uses a plain `<span>` with inline CSS vars for all three
  difficulties (consistent approach; avoids fighting HeroUI's chip color layer).
- ProgressBar fill width is driven by React Aria state via context — no manual
  width style needed on `ProgressBarFill`.
- QuestionCard `mode="review"` shows ReviewBar in Card.Footer; `mode="readonly"` omits it.
- Correct option highlighted with `--success-bg / --success-border`; others neutral.
- Explanation shown with left indigo accent border.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | n/a |
| Integration | n/a |
| E2E | n/a |
| Platform | `next build` exits 0 |
| Release | Composites render correctly in review studio (US-008) and quiz player (US-016) |

## Harness Delta

- `src/components/quiz/composites.ts` barrel — single import path for all composites.
- `src/components/ui/empty-state.tsx` — reusable across all surfaces.
- Gates: US-008 (review studio), US-009 (question review states), US-013 (review queue), US-016 (quiz player).

## Evidence

- `next build` exits 0 — 10 routes clean (2026-06-19).
- 7 new files: `src/components/quiz/{difficulty-chip,status-chip,confidence-meter,source-ref,review-bar,question-card,composites}.ts(x)`.
- `src/components/ui/empty-state.tsx`.
