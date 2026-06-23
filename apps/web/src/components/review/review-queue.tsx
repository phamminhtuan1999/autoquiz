"use client";

import { DifficultyChip } from "@/components/quiz/difficulty-chip";
import { StatusChip, type ReviewStatus } from "@/components/quiz/status-chip";
import { ConfidenceMeter } from "@/components/quiz/confidence-meter";

interface QueueItem {
  id: string;
  stem: string;
  difficulty: "Easy" | "Medium" | "Hard";
  status: ReviewStatus;
  confidence: number;
}

interface KPI {
  label: string;
  value: number | string;
  note?: string;
}

interface ReviewQueueProps {
  items: QueueItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  kpis?: KPI[];
}

export function ReviewQueue({ items, selectedId, onSelect, kpis }: ReviewQueueProps) {
  return (
    <div className="flex flex-col gap-4">
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] p-3"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">{kpi.label}</p>
              <p className="mt-1 font-mono text-xl font-semibold text-[var(--fg-strong)]">{kpi.value}</p>
              {kpi.note && <p className="mt-0.5 text-xs text-[var(--fg-faint)]">{kpi.note}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Question</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Difficulty</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
                  No questions yet. Generate from a document to get started.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelect?.(item.id)}
                  className={`cursor-pointer transition-colors hover:bg-[var(--bg-subtle)] ${
                    selectedId === item.id ? "bg-[var(--accent-subtle)]" : ""
                  }`}
                >
                  <td className="px-4 py-3 max-w-xs truncate text-[var(--fg)]">{item.stem}</td>
                  <td className="px-4 py-3">
                    <DifficultyChip difficulty={item.difficulty} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={item.status} />
                  </td>
                  <td className="px-4 py-3 w-32">
                    <ConfidenceMeter value={item.confidence} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
