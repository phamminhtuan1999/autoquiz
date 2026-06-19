"use client";

import { useRef, useEffect } from "react";
import { Button } from "@heroui/react";
import type { QuizQuestion } from "@/lib/gemini";

type QuizResultsProps = {
  questions: QuizQuestion[];
  userAnswers: Record<number, string>;
  onRetakeTest: () => void;
  onBackToPreview: () => void;
};

function getGrade(pct: number) {
  if (pct >= 90) return { grade: "A+", color: "var(--success)" };
  if (pct >= 80) return { grade: "B",  color: "var(--accent)"  };
  if (pct >= 70) return { grade: "C",  color: "var(--amber)"   };
  if (pct >= 60) return { grade: "D",  color: "var(--warning)" };
  return             { grade: "F",  color: "var(--danger)"  };
}

export function QuizResults({
  questions,
  userAnswers,
  onRetakeTest,
  onBackToPreview,
}: QuizResultsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const correct = questions.filter((q, i) => userAnswers[i] === q.answer).length;
  const pct = Math.round((correct / questions.length) * 100);
  const { grade, color } = getGrade(pct);

  return (
    <div ref={ref} className="space-y-8">
      {/* Score card */}
      <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-8 text-center">
        <div
          className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[var(--border)]"
          style={{ background: `color-mix(in oklab, ${color} 10%, var(--bg))` }}
        >
          <span className="font-display text-4xl font-bold" style={{ color }}>
            {grade}
          </span>
        </div>
        <p className="font-display text-xl font-semibold text-[var(--fg-strong)]">
          {pct >= 70 ? "Well done." : "Keep at it."}
        </p>
        <p className="mt-1 font-mono text-sm text-[var(--fg-muted)]">
          {correct}/{questions.length} correct — {pct}%
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onPress={onBackToPreview}>
            Review study material
          </Button>
          <Button variant="primary" onPress={onRetakeTest}>
            Retake quiz
          </Button>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="space-y-3">
        <h4 className="font-display text-base font-semibold text-[var(--fg)]">
          Breakdown
        </h4>
        {questions.map((q, i) => {
          const userAns = userAnswers[i];
          const isCorrect = userAns === q.answer;
          return (
            <div
              key={i}
              className={`rounded-[var(--r-md)] border p-5 ${
                isCorrect
                  ? "border-[var(--success-border)] bg-[var(--success-bg)]"
                  : "border-[var(--danger-border)] bg-[var(--danger-bg)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="font-mono text-xs font-semibold shrink-0 mt-0.5"
                  style={{ color: isCorrect ? "var(--success)" : "var(--danger)" }}
                >
                  {isCorrect ? "✓" : "✗"} {String(i + 1).padStart(2, "0")}
                </span>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--fg-strong)]">{q.question}</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="text-[var(--fg-muted)]">
                      Your answer:{" "}
                      <span className="font-medium" style={{ color: isCorrect ? "var(--success)" : "var(--danger)" }}>
                        {userAns || "—"}
                      </span>
                    </span>
                    {!isCorrect && (
                      <span className="text-[var(--fg-muted)]">
                        Correct:{" "}
                        <span className="font-medium text-[var(--success)]">{q.answer}</span>
                      </span>
                    )}
                  </div>
                  {q.explanation && (
                    <p className="border-l-2 border-[var(--accent-border)] pl-3 text-xs text-[var(--fg-muted)] italic">
                      {q.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
