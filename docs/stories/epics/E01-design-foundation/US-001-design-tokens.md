# US-001 Design tokens as CSS variables

## Status

implemented

## Lane

normal

## Product Contract

All DESIGN.md role-named tokens exist as CSS custom properties in `:root`.
Dark mode is a value swap under `.dark` — no separate stylesheet needed.
Token names are stable identifiers for all downstream composites.

## Relevant Product Docs

- `DESIGN.md` §3 Design tokens
- `docs/decisions/0008-heroui-design-system.md`

## Acceptance Criteria

- All DESIGN.md neutral ramp, accent, spark, semantic, and radius tokens defined
  in `:root` in `src/app/globals.css`.
- `.dark` selector swaps token values (no duplicate variable names).
- `next build` exits 0.
- No existing page broken.

## Design Notes

- Tokens: neutral ramp (--bg … --fg-faint), indigo accent, amber spark, semantic
  success/warning/danger/info (each with solid, bg, border variants), radius scale
  (--r-sm 8 · --r-md 10 · --r-lg 14 · --r-xl 20).
- Dark mode values derived from DESIGN.md guidance (warm dark neutrals, not blue-gray).

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | n/a |
| Integration | n/a |
| E2E | n/a |
| Platform | `next build` exits 0 |
| Release | Tokens inspectable via DevTools; dark mode swaps correctly |

## Harness Delta

Gates all composite components (US-005, US-006) and screen restyle stories.

## Evidence

- `next build` exits 0 — 10 routes clean (2026-06-19).
- `:root` tokens in `src/app/globals.css` lines 5–55.
- `.dark` swap block lines 57–85.
