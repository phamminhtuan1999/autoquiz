# US-004 Retire clay/neumorphic utilities and gradient background

## Status

implemented

## Lane

normal

## Product Contract

The neumorphic box-shadow system, gradient page background, and clay variable
definitions are removed. `.clay-card` and `.clay-button` are retained as flat
token-based stubs so existing JSX compiles without changes; they will be replaced
with HeroUI primitives in E02–E09 screen restyle stories.

## Relevant Product Docs

- `DESIGN.md` §1 P4 — "never gradients, mascots, neon, or sparkles"
- `docs/decisions/0008-heroui-design-system.md`

## Acceptance Criteria

- No `box-shadow` with neumorphic inset values in `globals.css`.
- No 4-stop radial-gradient on `body`.
- `--color-clay-shadow-*` variables removed.
- `.clay-card` renders as a flat bordered card using `--border` and `--r-lg`.
- `.clay-button` renders as a flat indigo button using `--accent` and `--r-md`.
- `next build` exits 0.
- No TypeScript compile errors from removed variables.

## Design Notes

- Stubs preserve class names intentionally — removing them would break ~10 files
  before their screen stories run. The stubs use DESIGN.md tokens directly.
- All existing pages remain functional (just visually simpler) until E02–E09.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | n/a |
| Integration | n/a |
| E2E | n/a |
| Platform | `next build` exits 0 |
| Release | Landing page renders flat card + button; no rainbow gradient on body |

## Harness Delta

Unblocks: every screen restyle story now builds on clean tokens, not clay.

## Evidence

- `next build` exits 0 — 10 routes clean (2026-06-19).
- `globals.css`: `.clay-card` and `.clay-button` are flat stubs; no inset
  box-shadows; no radial-gradient on `body`.
