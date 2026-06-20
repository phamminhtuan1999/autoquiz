# Product

## Register

product

## Users

**Teachers** — educators who upload course documents, review AI-generated questions, approve/reject before publishing, and monitor class performance. They work in dense, decision-heavy sessions: multiple quizzes in flight, questions to triage, analytics to scan.

**Students** — learners who take quizzes, flip flashcards, and review results. They come for short, focused study sessions. Calm, progressive, motivating — not a gamified grind.

Both roles share one design language but live at different densities. A teacher's "productive hour" and a student's "calm session" must feel intentional, not like two unrelated apps.

## Product Purpose

AutoQuiz turns source documents into grounded, reviewable quizzes. AI drafts; teachers approve; students learn. Every generated question cites the exact passage it came from — confidence is shown honestly, nothing reaches students until it's been reviewed.

Success: a teacher uploads a PDF and has a publishable, source-cited quiz in under 5 minutes. A student can pick up a study session and know exactly where they stand, without noise.

## Brand Personality

The smart, well-read study partner — the one who actually did the reading. Confident but never loud; encouraging but never saccharine.

- **Trustworthy** — shows its work; cites, scores, never overstates.
- **Focused** — one job per screen.
- **Encouraging** — celebrates real progress, not confetti.
- **Quietly playful** — a spark of amber, a friendly phrase. Grown-up tone.

Three words: **grounded · focused · warm**.

## Anti-references

- **Duolingo / Kahoot** — no gamification chrome, no owl, no bright multi-color nav, no streak-explosion animations. Motivation lives in real progress data, not mascots.
- **Canvas / Blackboard** — no institutional grey, no cluttered legacy LMS chrome, no dense sidebars of links that all look the same weight.
- **Generic SaaS dark sidebar** — no indistinguishable-from-1000-others layout: dark sidebar, blue primary, company logo top-left, icon-only nav rail.

## Design Principles

1. **Ground everything in the source.** If a question exists, its citation must be one click away. This principle extends to the UI: every piece of data should feel like it came from somewhere real, not generated out of thin air.
2. **AI drafts, humans approve.** The interface never presents generated content as final. Review gates are a first-class UX pattern, not a permission afterthought.
3. **Two moods, one system.** Teacher = productive and dense. Student = calm and focused. Same tokens, same component library, different density — never two design languages.
4. **Color is a signal, not decoration.** Indigo for the one action that matters. Green = mastery, amber = attention, rose = wrong. Non-semantic color is gray.
5. **The tool disappears into the task.** Navigation, chrome, and controls should be immediately familiar and then invisible. No invented affordances. No decorative motion. The quiz is the thing.

## Accessibility & Inclusion

WCAG 2.1 AA minimum: 4.5:1 contrast for body text, 3:1 for large text and UI components. Full keyboard navigability. Screen-reader labels on all interactive elements. `prefers-reduced-motion` respected on all transitions. Focus rings visible on all interactive elements (not hidden with `outline: none`).
