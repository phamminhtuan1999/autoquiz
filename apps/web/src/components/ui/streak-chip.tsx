"use client";

interface StreakChipProps {
  days: number;
  className?: string;
}

export function StreakChip({ days, className }: StreakChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--amber-border)] bg-[var(--amber-bg)] px-3 py-1 font-mono text-xs font-medium text-[var(--amber)] ${className ?? ""}`}
    >
      {days}-day streak
    </span>
  );
}

interface XPChipProps {
  xp: number;
  delta?: number;
  className?: string;
}

export function XPChip({ xp, delta, className }: XPChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--amber-border)] bg-[var(--amber-bg)] px-3 py-1 font-mono text-xs font-medium text-[var(--amber)] ${className ?? ""}`}
    >
      {xp.toLocaleString()} XP
      {delta != null && delta > 0 && (
        <span className="text-[var(--success)]">+{delta}</span>
      )}
    </span>
  );
}

interface ProgressNoteProps {
  message: string;
  className?: string;
}

export function ProgressNote({ message, className }: ProgressNoteProps) {
  return (
    <p className={`text-sm text-[var(--fg-muted)] ${className ?? ""}`}>
      {message}
    </p>
  );
}
