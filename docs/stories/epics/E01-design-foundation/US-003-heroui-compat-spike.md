# US-003 Adopt HeroUI: provider, theme plugin, token mapping

## Status

implemented

## Lane

normal

## Product Contract

HeroUI is installed and wired as the single interactive component foundation.
The app builds successfully with HeroUI installed alongside Tailwind v4, React 19,
and Next.js 16. The HeroUIProvider wraps the app. A minimal HeroUI Button renders
without errors in dev and production build.

## Relevant Product Docs

- `DESIGN.md` §5 Component library — HeroUI
- `docs/decisions/0008-heroui-design-system.md`
- `docs/initiatives/0001-design-system-redesign.md`

## Acceptance Criteria

- `@heroui/react` installed with no unresolvable peer-dependency conflicts.
- `HeroUIProvider` wraps the root layout (server-safe: `use client` boundary in a
  wrapper component).
- `next build` exits 0 with HeroUI installed.
- A `<Button>` from `@heroui/react` renders in the browser without console errors.
- No existing page is broken (build passes; dev server loads `/`).

## Design Notes

- API: none — install + wiring only.
- UI surfaces: `src/app/layout.tsx` (provider wrapper), `src/app/page.tsx` (smoke Button).
- HeroUI v3 targets Tailwind v4 natively — no `tailwind.config.js` needed; the
  `heroui()` function is imported and called inside the CSS `@plugin` directive.
- Provider must live in a `"use client"` component; the root layout stays a Server
  Component by importing a thin `Providers` wrapper.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | n/a (spike) |
| Integration | n/a (spike) |
| E2E | n/a (spike) |
| Platform | `next build` exits 0 with HeroUI wired |
| Release | HeroUI Button renders in dev browser without console errors |

## Harness Delta

- Story status → in_progress on start, implemented on build pass.
- Gates US-001, US-002, US-004, US-005, US-006 (all depend on HeroUI being live).

## Evidence

- `next build` exits 0 — 10 routes compiled clean (2026-06-19).
- HeroUI CSS integration: `@import "@heroui/react/styles"` in `globals.css` replaces
  `@import "tailwindcss"` — no `tailwind.config.js` needed.
- No `HeroUIProvider` required (v3 is provider-free).
- `tw-animate-css` is a transitive dep of `@heroui/styles` — installed automatically.
- **v3 API change from v2/NextUI**: `variant="primary"` (not `color="primary" variant="solid"`).
  Valid variants: `primary | secondary | tertiary | danger | danger-soft | ghost | outline`.
- Smoke `<Button variant="primary">` in `src/app/page.tsx` renders without console errors.
