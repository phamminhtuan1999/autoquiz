AutoQuiz — Design System
Version 1.0 · Proposal

A premium modern study studio. Upload a document; AI drafts quizzes, flashcards, practice tests, and answer keys — every question grounded in a real source, scored for confidence, and reviewed before it ships.

References: NotebookLM (source-grounded AI workspace) · Quizlet (study practice & friendly cards) · Gamma / Canva Docs (polished, editable AI content). Kahoot/Wayground inform live engagement only, never the core visual style.

Foundation: HeroUI + Tailwind · Sora / Plus Jakarta Sans / Geist Mono · two surfaces (dense teacher console, calm student studio).

1. Design principles
#	Principle	What it means
P1	Grounded in the source	Nothing is invented. Every generated question cites the exact passage it came from; the source is one click away.
P2	AI drafts, humans approve	Generation is a starting point. Confidence is shown honestly; nothing publishes to students until a teacher reviews it.
P3	Two moods, one system	Teacher surface = dense and productive. Student surface = calm and motivating. Same tokens, different density — never two design languages.
P4	Calm, not childish	Warm paper neutrals, one accent, hairline borders. Playfulness lives in copy and a single amber spark — never gradients, mascots, neon, or sparkles.
P5	Color is a signal	Indigo marks the one action that matters. Green = mastery, amber = attention, rose = wrong. Non-semantic color is gray.
P6	Editable, like a doc	Generated content is a polished draft you can rewrite inline, the way you'd edit a Gamma or Canva doc (Tiptap).
2. Brand personality
The smart, well-read study partner — the one who actually did the reading. Confident but never loud; encouraging but never saccharine.

Trustworthy — shows its work; cites, scores, never overstates.
Focused — one job per screen.
Encouraging — celebrates progress with warmth, not confetti.
Quietly playful — a spark of amber, a friendly phrase. Grown-up tone.
Is: premium modern study studio · source-grounded & review-first · calm, editorial, confidently neutral · motivating through real progress.

Is not: a colorful classroom game clone · robot mascots / neon / glassmorphism · rainbow gradients & random sparkles · confident about answers it can't ground.

Voice (we say / not): - Generation done → "12 questions drafted from your PDF. Review before publishing." (not "🎉 AI magic complete!! ✨") - Wrong answer → "Not quite — here's why, with the source." (not "Oops! Try again, buddy! 😅") - Streak → "5-day streak. Nicely done." (not "🔥🔥 YOU'RE ON FIRE!!! 🔥🔥")

3. Design tokens
Tokens are named by role, so dark mode is a value swap. They live as CSS variables and feed the HeroUI theme via the heroui() Tailwind plugin.

Neutral ramp — warm paper
--bg            #ffffff
--bg-subtle     #faf9f7
--bg-muted      #f3f1ec
--bg-inset      #f7f5f1
--border        #ece9e3
--border-strong #e1ddd4
--border-stronger #cfcabf
--fg            #1c1a17
--fg-strong     #2a2722
--fg-muted      #57534e
--fg-subtle     #79746c
--fg-faint      #a9a39a
Accent — indigo (action)
--accent        #4f46e5
--accent-hover  #4338ca
--accent-subtle #eef0fe
--accent-border #d7dafb
--accent-fg     #ffffff
Spark — amber (motivation: streaks, XP, "due soon")
--amber-solid   #f59e0b
--amber         #b45309   (text)
--amber-bg      #fdf4e3
--amber-border  #f4d99a
Semantic — meaning, not decoration
--success #15803d  bg #f0fdf4  border #bbf7d0  solid #16a34a   (correct / mastery)
--warning #b45309  bg #fffbeb  border #fde68a                  (needs review)
--danger  #dc2626  bg #fef2f2  border #fecaca                  (incorrect / flagged)
--info    #2563eb  bg #eff6ff  border #bfdbfe                  (source / citation)
Confidence & difficulty
Confidence: High 85–100 (green) · Medium 60–84 (amber) · Low <60 (rose). Always a bar and a number.
Difficulty: Easy (green) · Medium (amber) · Hard = violet #7c3aed — kept off red so it never collides with the "incorrect" signal.
Radius, spacing, elevation
radius:  sm 8 · md 10 · lg 14 · xl 20 · full
spacing: 4px base grid (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64)
shadow:  warm-tinted rgba(28,26,23,*); reserved for things that truly float
         (popover, command menu, flashcard). Borders carry normal elevation.
4. Typography
Role	Family	Spec	Usage
display / hero	Sora	44 / 700 / -.04em	Hero & display headings
h1	Sora	30 / 700	
h2	Sora	24 / 600	
h3	Plus Jakarta Sans	20 / 600	
question	Plus Jakarta Sans	17 / 500	Quiz stems
body	Plus Jakarta Sans	14 / 400 · 1.6	Default reading size (body/UI)
small	Plus Jakarta Sans	13 / 400	Helper text, citations
label	Plus Jakarta Sans	12 / 500 / caps	
mono	Geist Mono	13	Source refs, quiz codes, confidence %, difficulty, AI metadata only
Rules: Sora carries hero and display headings — modern, geometric, tight and bold. Plus Jakarta Sans is the primary body/UI font (readability first on dashboard and quiz player). Geist Mono is reserved strictly for source-grounded AI details.

5. Component library — HeroUI
HeroUI is the foundation for everything interactive. No bespoke component library; each primitive is restyled with AutoQuiz tokens through the HeroUI theme.

Used directly: Button · Card · Modal · Tabs · Input · Textarea · Select · Checkbox · Radio · Switch · Slider · Chip (badges/status) · Progress · Tooltip · Popover · Dropdown · Table · Avatar.

Component mapping — AutoQuiz → HeroUI
AutoQuiz component	HeroUI primitive	Notes
QuestionCard	Card	Header = meta chips; Body = stem + options; Footer = review bar.
DifficultyChip · StatusChip	Chip	Variant map keyed on level/status (variant="flat").
ConfidenceMeter	Progress	Thin bar + Geist Mono % label; green / amber / rose thresholds.
GenerateWizard	Modal · Tabs · Select · Slider	Stepped modal; output toggles as Chip group; difficulty mix on Sliders.
ReviewQueue	Tabs · Table	HeroUI Table for the standard queue; TanStack Table for the full bank.
QuizPlayer	Card · RadioGroup · Progress · Button	One question per Card; styled RadioGroup; feedback panel below.
SourceRef · row actions	Tooltip · Popover · Dropdown	Citation chip opens a Popover with the cited passage.
QuestionEditor · ExplanationEditor	Tiptap in Modal	Rich inline editing of generated text.
Additional libraries — used sparingly
Tiptap — editing generated questions, options, and explanations (mounted in HeroUI Modals/drawers).
Tremor / Recharts — teacher analytics charts only, themed to the AutoQuiz palette.
React Bits — landing-page animation only. Never inside the app; no animated chrome in dashboard or quiz player.
TanStack Table — advanced question-bank and student-result tables only (sort/filter/virtualize), styled with AutoQuiz tokens.
6. Role-based layouts
Teacher — dense & productive
Persistent shell: 46px top bar (logo · search/⌘K · + Generate · avatar) + ~184px left rail (Workspace: Library, Review queue ·badge, Question bank, Flashcards / Teach: Classes, Analytics). Main area defaults to the Review queue: a 4-up KPI strip (Drafted / Needs review / Approved / Avg confidence) above a compact table with inline approve/reject. 13px body, tight rows, everything one click away.

Student — calm, focused & motivating
Minimal top bar (logo · streak chip · avatar). Centered ~680px column on warm paper: a greeting, a prominent Continue studying card with progress, two large study-mode cards (Flashcards / Practice test), and one gentle progress note ("Mastery up 12% this week"). Generous spacing, larger type, quiet motivation — no leaderboards-in-your-face.

7. Document upload & generation wizard
Three calm steps in a HeroUI Modal:

Upload a source — drag-drop a PDF / slides / doc, or paste text (max 50MB). Parsed file shows page count + ready state.
Configure output — choose what to generate (Quiz / Flashcards / Practice test / Answer key as Chip toggles); set difficulty mix (Easy/Medium/Hard sliders); set source grounding strictness (Strict = only from the document) as a first-class Switch.
Generate — live progress: Reading sources → Drafting questions → Scoring confidence. Output lands in the review queue, never auto-published.
8. Source-grounded question review studio
The signature workspace — a three-pane layout that keeps you anchored to sources (NotebookLM-style):

Left — source document. The PDF with the cited passage highlighted; page reference in Geist Mono.
Center — question under review. Stem, options (correct marked), the verbatim source block, and approve / edit / reject.
Right — batch. The rest of the queue with confidence % and difficulty; the active question is highlighted.
Every generated question always shows: source reference · confidence · difficulty · explanation. Review actions: Approve · Edit (Tiptap) · Regenerate · Reject. No publish path skips review.

9. Quiz player UI
The student surface at its calmest: a quiet top progress bar, one question per screen, generous space, Geist Mono question counter and timer. Options as a styled RadioGroup; feedback is immediate and grounded — correctness + explanation + source citation appear the moment they answer. Flashcards flip (tap; "Still learning" / "Got it"); results show score, XP, and a "review missed" path. Motivation is real progress, not noise.

10. Teacher analytics
Dense and decision-oriented (Tremor/Recharts, AutoQuiz-themed). Each chart answers one question: - KPIs: avg score, completion, avg time, topics needing attention. - Class mastery over time — area/line across quizzes. - Score distribution — donut (green/amber/rose bands). - Accuracy by question — horizontal bars; low scorers flag questions to revisit.

Color stays semantic; no gratuitous gradients.

11. MVP implementation plan
Token → HeroUI theme
CSS variable	HeroUI theme token
--accent #4f46e5	primary.DEFAULT
--bg #ffffff	background
--fg #1c1a17	foreground
--border #ece9e3	default-200 · divider
--r-md 10px	radius.medium
Install order
Theme layer — tokens as CSS variables; register the heroui() Tailwind plugin; install Sora, Plus Jakarta Sans & Geist Mono.
Primitives — wrap the app in HeroUIProvider; add Button, Card, Input, Select, Tabs, Modal, Chip, Progress, Tooltip, Dropdown, Table.
Composites — QuestionCard, ConfidenceMeter, DifficultyChip, SourceRef, ReviewBar, EmptyState.
Screens — GenerateWizard → ReviewStudio → TeacherConsole → StudentHome → QuizPlayer.
Build phases
Phase	Scope	Priority
P0 · Core	Upload → generate → review → publish. Grounded QuestionCard, review studio, confidence/source/difficulty/explanation model.	Must ship
P1 · Study	Student surface: quiz player, flashcards, practice tests, grounded feedback, streaks & XP, results.	High
P2 · Scale	Classes & rosters, per-student analytics, mastery tracking, answer-key export, shared question bank.	Medium
P3 · Live	Optional live quiz engagement (Kahoot-style) — kept visually quiet, a feature not the brand.	Later
Non-negotiables
Every generated question shows source reference, confidence, difficulty, and explanation.
AI-generated questions must be reviewed before publishing.
Teacher dashboard is productive and dense; student quiz mode is calm, readable, motivating.
Avoid excessive gradients, mascots, sparkles, and random animation. React Bits motion is landing-only.