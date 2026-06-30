"use client";

import { StreakChip, XPChip, ProgressNote } from "@/components/ui/streak-chip";

interface StudyMode {
  key: string;
  label: string;
  description: string;
  href: string;
}

interface StudentHomeProps {
  userName?: string;
  streakDays?: number;
  xp?: number;
  xpDelta?: number;
  masteryDelta?: number;
  continueHref?: string;
  continueLabel?: string;
  continueProgress?: number;
  studyModes?: StudyMode[];
}

// US-RAG-015: study modes now generate from a source document via the RAG flow.
const DEFAULT_MODES: StudyMode[] = [
  { key: "flashcards", label: "Flashcards", description: "Flip through key concepts", href: "/dashboard/documents" },
  { key: "practice", label: "Practice test", description: "Timed exam simulation", href: "/dashboard/documents" },
];

export function StudentHome({
  userName,
  streakDays = 0,
  xp = 0,
  xpDelta,
  masteryDelta,
  continueHref = "/dashboard",
  continueLabel = "Continue studying",
  continueProgress = 0,
  studyModes = DEFAULT_MODES,
}: StudentHomeProps) {
  return (
    <div className="mx-auto max-w-[680px] space-y-8 py-12">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg-strong)]">
            {userName ? `Welcome back, ${userName}.` : "Welcome back."}
          </h1>
          {masteryDelta != null && masteryDelta > 0 && (
            <ProgressNote
              message={`Mastery up ${masteryDelta}% this week.`}
              className="mt-1"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {streakDays > 0 && <StreakChip days={streakDays} />}
          <XPChip xp={xp} delta={xpDelta} />
        </div>
      </div>

      {/* Continue studying card */}
      <div className="rounded-[var(--r-lg)] border border-[var(--accent-border)] bg-[var(--accent-subtle)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              Continue where you left off
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-[var(--fg-strong)]">
              {continueLabel}
            </p>
          </div>
          <a
            href={continueHref}
            className="inline-flex items-center rounded-[var(--r-sm)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Resume
          </a>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--accent-border)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${continueProgress}%` }}
          />
        </div>
        <p className="mt-1.5 font-mono text-xs text-[var(--fg-subtle)]">
          {continueProgress}% complete
        </p>
      </div>

      {/* Study modes */}
      <div className="grid gap-4 sm:grid-cols-2">
        {studyModes.map((mode) => (
          <a
            key={mode.key}
            href={mode.href}
            className="group rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
          >
            <p className="font-display text-base font-semibold text-[var(--fg-strong)] group-hover:text-[var(--accent)] transition-colors">
              {mode.label}
            </p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">{mode.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
