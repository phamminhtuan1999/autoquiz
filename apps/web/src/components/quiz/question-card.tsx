"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@heroui/react";
import { DifficultyChip, type Difficulty } from "./difficulty-chip";
import { StatusChip, type ReviewStatus } from "./status-chip";
import { ConfidenceMeter } from "./confidence-meter";
import { SourceRef } from "./source-ref";
import { ReviewBar } from "./review-bar";

interface Option {
  id: string;
  text: string;
  isCorrect?: boolean;
}

interface Source {
  passage: string;
  page?: number;
}

interface QuestionCardProps {
  stem: string;
  options: Option[];
  difficulty: Difficulty;
  confidence?: number;
  status?: ReviewStatus;
  source?: Source;
  explanation?: string;
  mode?: "review" | "readonly";
  selectedOptionId?: string;
  onApprove?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onReject?: () => void;
}

export function QuestionCard({
  stem,
  options,
  difficulty,
  confidence,
  status = "drafted",
  source,
  explanation,
  mode = "readonly",
  onApprove,
  onEdit,
  onRegenerate,
  onReject,
}: QuestionCardProps) {
  return (
    <Card className="border border-[var(--border)] bg-[var(--bg)]">
      <CardHeader className="flex flex-wrap items-center gap-2 pb-2">
        <DifficultyChip difficulty={difficulty} />
        <StatusChip status={status} />
        {source && <SourceRef passage={source.passage} page={source.page} />}
        {confidence != null && (
          <div className="ml-auto w-32">
            <ConfidenceMeter value={confidence} />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-[17px] font-medium leading-snug text-[var(--fg-strong)]">{stem}</p>

        <ul className="space-y-2">
          {options.map((opt) => (
            <li
              key={opt.id}
              className={`rounded-[var(--r-sm)] border px-3 py-2 text-sm transition-colors ${
                opt.isCorrect
                  ? "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]"
                  : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg-muted)]"
              }`}
            >
              {opt.text}
            </li>
          ))}
        </ul>

        {explanation && (
          <p className="border-l-2 border-[var(--accent-border)] pl-3 text-sm text-[var(--fg-muted)] italic">
            {explanation}
          </p>
        )}
      </CardContent>

      {mode === "review" && (
        <CardFooter className="border-t border-[var(--border)] pt-3">
          <ReviewBar
            onApprove={onApprove}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onReject={onReject}
          />
        </CardFooter>
      )}
    </Card>
  );
}
