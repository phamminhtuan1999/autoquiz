# US-005 Wire HeroUI primitives

## Status

implemented

## Lane

normal

## Product Contract

All HeroUI primitive components named in DESIGN.md §5 are importable from a
single barrel path (`@/components/ui/primitives`). HeroUI's internal CSS
variables are bridged to the DESIGN.md token set so HeroUI components render
with AutoQuiz colours, radius, and surface values. Dark mode is synchronised
between next-themes (`.dark` class) and HeroUI's theme selector.

## Relevant Product Docs

- `DESIGN.md` §5 Component library — HeroUI
- `DESIGN.md` §11 MVP implementation plan (token → HeroUI theme mapping)
- `docs/decisions/0008-heroui-design-system.md`

## Acceptance Criteria

- `src/components/ui/primitives.ts` re-exports Button, Card, Modal, Tabs, Input,
  Textarea, Select, Checkbox, Radio, Switch, Slider, Chip, Progress, Tooltip,
  Popover, Dropdown, Table, Avatar from `@heroui/react`.
- `:root` in `globals.css` maps `--background`, `--foreground`, `--surface`,
  `--radius`, `--accent-foreground`, `--muted` to DESIGN.md tokens.
- `.dark` in `globals.css` maps `--background` and `--surface` to dark tokens.
- HeroUI `<Button variant="primary">` renders in indigo, not HeroUI's default blue.
- `next build` exits 0.
- Smoke Button removed from `src/app/page.tsx`.

## Design Notes

- HeroUI v3 variable names that conflict/differ from ours and need bridging:
  `--background` (ours: `--bg`), `--foreground` (ours: `--fg`),
  `--surface` (ours: `--bg` / `--bg-subtle` dark), `--radius` (ours: `--r-md`),
  `--accent-foreground` (ours: `--accent-fg`), `--muted` (ours: `--fg-muted`).
- Our `--accent`, `--border`, `--success`, `--warning`, `--danger` already share
  names with HeroUI vars — they auto-override since our `:root` is unlayered.
- next-themes `attribute="class"` adds `.dark` to `<html>` — same selector HeroUI
  watches. No additional wiring needed.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | n/a |
| Integration | n/a |
| E2E | n/a |
| Platform | `next build` exits 0 |
| Release | HeroUI Button renders in `--accent` indigo; Card uses `--bg` surface |

## Harness Delta

Gates US-006 (AutoQuiz composites) and all screen restyle stories.

## Evidence

- `next build` exits 0 — 10 routes clean (2026-06-19).
- HeroUI bridge in `src/app/globals.css` `:root` and `.dark` blocks.
- Primitives barrel: `src/components/ui/primitives.ts` — 24 exports covering all
  DESIGN.md §5 components.
- **v3 API finding**: compound components use dot notation (`Modal.Body`, `Modal.Header`,
  `Dropdown.Menu`, `Dropdown.Trigger`, `Table.Column`, `Table.Row`, etc.) — these
  are not separately exported from `@heroui/react`'s top-level index. `Progress`
  is split into `ProgressBar` and `ProgressCircle`; `Textarea` is not in main
  export (use `Input` with multiline or import from `@heroui/react/textarea`).
- Smoke Button removed from `src/app/page.tsx`.
