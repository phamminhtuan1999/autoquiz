"use client";

import type { CramResult, GoldenNugget, BlitzQuestion } from "@/types/cram";

export function CramModeDisplay({ cramResult }: { cramResult: CramResult }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Golden Nuggets */}
      <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-6">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h2 className="font-display text-base font-semibold text-[var(--fg-strong)]">
            Key concepts
          </h2>
          <span className="font-mono text-xs text-[var(--fg-faint)]">
            {cramResult.summary.length} facts
          </span>
        </div>
        <div className="space-y-3">
          {cramResult.summary.map((nugget: GoldenNugget, index: number) => (
            <div
              key={index}
              className="rounded-[var(--r-sm)] border border-[var(--amber-border)] bg-[var(--amber-bg)] p-4"
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-semibold text-[var(--amber)] shrink-0 mt-0.5">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="mb-1 text-sm font-semibold text-[var(--fg-strong)]">{nugget.topic}</p>
                  <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{nugget.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blitz Flashcards */}
      <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-6">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h2 className="font-display text-base font-semibold text-[var(--fg-strong)]">
            Quick recall
          </h2>
          <span className="font-mono text-xs text-[var(--fg-faint)]">
            {cramResult.blitz_questions.length} questions
          </span>
        </div>
        <div className="max-h-[calc(100vh-400px)] space-y-3 overflow-y-auto">
          {cramResult.blitz_questions.map((card: BlitzQuestion, index: number) => (
            <div
              key={index}
              className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] p-4"
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-semibold text-[var(--fg-faint)] shrink-0 mt-0.5">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--fg)]">{card.question}</p>
                  <div className="border-t border-[var(--border)] pt-2">
                    <p className="text-sm text-[var(--fg-muted)]">
                      <span className="font-semibold text-[var(--fg)]">Answer: </span>
                      {card.answer}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
