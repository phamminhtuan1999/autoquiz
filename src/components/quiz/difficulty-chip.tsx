"use client";

const CONFIG = {
  Easy:   { bg: "var(--success-bg)",  color: "var(--success)",  border: "var(--success-border)"  },
  Medium: { bg: "var(--amber-bg)",    color: "var(--amber)",    border: "var(--amber-border)"    },
  Hard:   { bg: "#f5f3ff",            color: "#7c3aed",         border: "#ddd6fe"                },
} as const;

export type Difficulty = keyof typeof CONFIG;

export function DifficultyChip({ difficulty }: { difficulty: Difficulty }) {
  const s = CONFIG[difficulty];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs font-medium"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      {difficulty}
    </span>
  );
}
