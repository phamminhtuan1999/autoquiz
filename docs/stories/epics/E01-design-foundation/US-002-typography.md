# US-002 Typography: Sora / Plus Jakarta Sans / Geist Mono

## Status

implemented

## Lane

tiny

## Product Contract

The three DESIGN.md typefaces are loaded and wired. Sora serves display/headings,
Plus Jakarta Sans is the default body/UI font, Geist Mono is available for
source-grounded AI metadata. Fredoka and Nunito are removed.

## Relevant Product Docs

- `DESIGN.md` §4 Typography

## Acceptance Criteria

- `Sora`, `Plus_Jakarta_Sans`, `Geist_Mono` loaded via `next/font/google` in
  `src/app/layout.tsx`.
- CSS variables `--font-sora`, `--font-plus-jakarta-sans`, `--font-geist-mono`
  injected on `<body>`.
- `@theme inline` maps `--font-display`, `--font-sans`, `--font-mono` to the
  next/font variables.
- `body` uses `--font-sans`; `h1–h6` use `--font-display`.
- Fredoka and Nunito imports removed.
- `next build` exits 0.

## Design Notes

- DESIGN.md type scale: Sora 44/700 (display) · 30/700 (h1) · 24/600 (h2);
  Plus Jakarta Sans 20/600 (h3) · 17/500 (question) · 14/400 (body) · 13/400 (small) · 12/500 (label);
  Geist Mono 13 (mono — AI metadata only).
- Individual size/weight classes applied per-component in later stories.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | n/a |
| Integration | n/a |
| E2E | n/a |
| Platform | `next build` exits 0 |
| Release | DevTools confirms Sora on h1, Plus Jakarta Sans on body, Geist Mono on mono |

## Harness Delta

Unblocks display heading classes in all screen restyle stories.

## Evidence

- `next build` exits 0 — 10 routes clean (2026-06-19).
- Font imports in `src/app/layout.tsx` lines 3, 9–24.
- `@theme inline` in `src/app/globals.css`.
