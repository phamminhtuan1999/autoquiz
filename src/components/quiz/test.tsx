"use client";

import { Button } from "@heroui/react";
import type { QuizQuestion } from "@/lib/gemini";

type QuizTestProps = {
  questions: QuizQuestion[];
  userAnswers: Record<number, string>;
  onAnswerChange: (questionIndex: number, answer: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
};

export function QuizTest({
  questions,
  userAnswers,
  onAnswerChange,
  onSubmit,
  isSubmitting,
}: QuizTestProps) {
  const answeredCount = Object.keys(userAnswers).length;
  const allAnswered = answeredCount === questions.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
        <h3 className="font-display text-base font-semibold text-[var(--fg-strong)]">
          Quiz
          <span className="ml-2 font-mono text-sm font-normal text-[var(--fg-muted)]">
            {questions.length} questions
          </span>
        </h3>
        <span className="font-mono text-sm text-[var(--fg-muted)]">
          {answeredCount}/{questions.length} answered
        </span>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <div
            key={index}
            className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5"
          >
            <div className="flex items-start gap-4">
              <span className="font-mono text-sm font-semibold text-[var(--fg-faint)] mt-0.5 shrink-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 space-y-4">
                <p className="text-[17px] font-medium leading-snug text-[var(--fg-strong)]">
                  {question.question}
                </p>
                <div className="grid gap-2">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = userAnswers[index] === option;
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        onClick={() => onAnswerChange(index, option)}
                        className={`flex items-center gap-3 rounded-[var(--r-sm)] border px-4 py-3 text-left text-sm transition-all ${
                          isSelected
                            ? "border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent)] font-medium"
                            : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            isSelected
                              ? "border-[var(--accent)] bg-[var(--accent)]"
                              : "border-[var(--border-stronger)]"
                          }`}
                        >
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="flex flex-col items-end gap-2">
        {!allAnswered && (
          <p className="text-sm text-[var(--fg-muted)]">
            Answer all questions to submit.
          </p>
        )}
        <Button
          variant="primary"
          onPress={onSubmit}
          isDisabled={!allAnswered || isSubmitting}
        >
          {isSubmitting ? "Submitting…" : "Submit quiz"}
        </Button>
      </div>
    </div>
  );
}
