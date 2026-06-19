# 0008 Adopt HeroUI + AutoQuiz Design System

Date: 2026-06-19

## Status

Accepted

## Context

`DESIGN.md` (v1.0 proposal) defines a "premium modern study studio": warm-paper
neutrals, a single indigo accent, an amber spark, hairline borders, and three
typefaces (Sora / Plus Jakarta Sans / Geist Mono). It explicitly rejects
gradients, neumorphism, mascots, and "colorful classroom game" styling.

The current UI is the opposite of that target: a bespoke "clay"/neumorphic
system (`src/app/globals.css` — `.clay-card`, `.clay-button`, soft inset
shadows), a four-stop radial-gradient page background, and Fredoka + Nunito
display fonts. There is no shared component library; screens hand-roll styling.

DESIGN.md names HeroUI as the foundation for everything interactive ("No bespoke
component library") and maps every AutoQuiz component onto a HeroUI primitive.
The human confirmed on 2026-06-19 the choice "Adopt HeroUI, replace clay."

## Decision

Adopt HeroUI as the single foundation for interactive components, themed through
the `heroui()` Tailwind plugin and the DESIGN.md CSS-variable tokens.
Specifically:

- Replace Fredoka/Nunito with Sora (display), Plus Jakarta Sans (body/UI), and
  Geist Mono (source-grounded AI metadata) via `next/font`.
- Define role-named CSS-variable tokens (neutral ramp, indigo accent, amber
  spark, semantic, confidence/difficulty) so dark mode is a value swap, and map
  the core tokens onto the HeroUI theme.
- Retire the clay/neumorphic utilities and the gradient body background.
- Build AutoQuiz composites (QuestionCard, ConfidenceMeter, DifficultyChip,
  StatusChip, SourceRef, ReviewBar, EmptyState) on HeroUI primitives.

This first pass is visual-only. Teacher/student roles, the review-to-publish
authorization gate, and the source/confidence data model are deferred to E04/E11
and require their own decision before implementation (FEATURE_INTAKE hard gates:
authorization, data model).

## Alternatives Considered

1. Apply the new tokens/aesthetic on the current React/Tailwind stack with no
   HeroUI dependency. Rejected: diverges from the DESIGN.md component mapping and
   keeps a bespoke component layer to maintain.
2. Adopt HeroUI incrementally (new screens HeroUI, migrate clay over time).
   Deferred, not rejected: two systems coexisting raises entropy during the
   transition; revisit only if the compatibility spike (US-003) blocks a clean
   cutover.

## Consequences

Positive:

- One themed, accessible component system; dark mode becomes a token swap.
- Faster, consistent screen building for the P0–P1 surfaces.
- Source-grounded primitives (confidence, difficulty, citation) become reusable.

Tradeoffs:

- New runtime dependency and theme layer.
- HeroUI's compatibility with Tailwind v4 + React 19 + Next 16 is unverified and
  must be proven before mass restyle. If blocked, fallback is pinning Tailwind v3
  or reverting to alternative (1) — both reopen this decision.
- The migration touches every existing screen (landing, dashboard, quiz, cram,
  mock-exam, leaderboard, credits).

## Follow-Up

- US-003: HeroUI compatibility spike on the current stack; record the result.
- Backlog: "HeroUI ↔ Tailwind v4 / React 19 compat" risk item.
- New decision required before E11 (teacher/student roles + authorization).
