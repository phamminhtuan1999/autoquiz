"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { QuestionCard } from "@/components/quiz/question-card";
import { DifficultyChip } from "@/components/quiz/difficulty-chip";
import { ConfidenceMeter } from "@/components/quiz/confidence-meter";
import { EmptyState } from "@/components/ui/empty-state";

interface ReviewQuestion {
  id: string;
  stem: string;
  options: { id: string; text: string; isCorrect?: boolean }[];
  difficulty: "Easy" | "Medium" | "Hard";
  confidence: number;
  status: "drafted" | "needs-review" | "approved" | "rejected";
  source?: { passage: string; page?: number };
  explanation?: string;
}

interface ReviewStudioProps {
  questions: ReviewQuestion[];
  sourcePdfUrl?: string;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onEdit?: (id: string) => void;
  onRegenerate?: (id: string) => void;
}

export function ReviewStudio({
  questions,
  onApprove,
  onReject,
  onEdit,
  onRegenerate,
}: ReviewStudioProps) {
  const [activeId, setActiveId] = useState<string | null>(
    questions[0]?.id ?? null
  );

  const active = questions.find((q) => q.id === activeId);

  return (
    <div className="flex h-full min-h-0 gap-0 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)]">
      {/* Left pane — source (placeholder) */}
      <div className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-subtle)] lg:flex">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Source</p>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-xs text-[var(--fg-faint)]">
            PDF viewer loads here.
            <br />
            Cited passage highlights automatically.
          </p>
        </div>
      </div>

      {/* Center pane — active question */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[var(--border)] px-6 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
            Review
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {active ? (
            <QuestionCard
              stem={active.stem}
              options={active.options}
              difficulty={active.difficulty}
              confidence={active.confidence}
              status={active.status}
              source={active.source}
              explanation={active.explanation}
              mode="review"
              onApprove={() => onApprove?.(active.id)}
              onEdit={() => onEdit?.(active.id)}
              onRegenerate={() => onRegenerate?.(active.id)}
              onReject={() => onReject?.(active.id)}
            />
          ) : (
            <EmptyState
              heading="No questions to review"
              description="Generate a quiz from a document to populate the review queue."
            />
          )}
        </div>
      </div>

      {/* Right pane — queue */}
      <div className="flex w-56 shrink-0 flex-col border-l border-[var(--border)]">
        <div className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Queue</p>
          <span className="font-mono text-xs text-[var(--fg-faint)]">{questions.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
          {questions.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setActiveId(q.id)}
              className={`w-full px-4 py-3 text-left transition-colors hover:bg-[var(--bg-subtle)] ${
                activeId === q.id ? "bg-[var(--accent-subtle)]" : ""
              }`}
            >
              <p className="mb-1.5 line-clamp-2 text-xs text-[var(--fg)]">{q.stem}</p>
              <div className="flex items-center gap-1.5">
                <DifficultyChip difficulty={q.difficulty} />
                <ConfidenceMeter value={q.confidence} showLabel={false} className="flex-1" />
                <span className="font-mono text-xs text-[var(--fg-faint)]">{q.confidence}%</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
