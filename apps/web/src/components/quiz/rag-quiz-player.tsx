"use client";

import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Check, X, RotateCcw } from "lucide-react";
import { SourceRef } from "./source-ref";
import { DifficultyChip, type Difficulty } from "./difficulty-chip";
import { recordRagAttempt } from "@/actions/record-rag-attempt";

export type PlayerOption = {
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
};

export type PlayerQuestion = {
  id: string;
  prompt: string;
  difficulty: string | null;
  topic: string | null;
  explanation: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  sourceExcerpt: string | null;
  options: PlayerOption[];
};

const DIFFICULTY_LABEL: Record<string, Difficulty> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function RagQuizPlayer({
  quizSetId,
  questions,
}: {
  quizSetId: string;
  questions: PlayerQuestion[];
}) {
  // questionId -> selected optionId. A question is "answered" once it has an entry.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const correctCount = useMemo(
    () =>
      questions.reduce((n, q) => {
        const chosen = answers[q.id];
        const opt = q.options.find((o) => o.id === chosen);
        return n + (opt?.isCorrect ? 1 : 0);
      }, 0),
    [answers, questions]
  );

  const select = (q: PlayerQuestion, opt: PlayerOption) => {
    if (answers[q.id]) return; // lock after first answer
    setAnswers((prev) => ({ ...prev, [q.id]: opt.id }));
    void recordRagAttempt({
      questionId: q.id,
      quizSetId,
      selectedOptionId: opt.id,
      isCorrect: opt.isCorrect,
    });
  };

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pct = questions.length
    ? Math.round((correctCount / questions.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Progress / score bar */}
      <div className="sticky top-0 z-10 flex items-center gap-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-[var(--fg-muted)]">
          {answeredCount}/{questions.length} answered
        </span>
      </div>

      <ol className="space-y-5">
        {questions.map((q, i) => {
          const chosenId = answers[q.id];
          const answered = Boolean(chosenId);
          const diff = q.difficulty ? DIFFICULTY_LABEL[q.difficulty] : undefined;
          return (
            <li
              key={q.id}
              className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5 sm:p-6"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-[var(--fg-faint)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {diff && <DifficultyChip difficulty={diff} />}
                {q.topic && (
                  <span className="font-mono text-xs text-[var(--fg-faint)]">
                    {q.topic}
                  </span>
                )}
                {(q.sourcePageStart != null || q.sourceExcerpt) && (
                  <span className="ml-auto">
                    <SourceRef
                      page={q.sourcePageStart ?? undefined}
                      passage={q.sourceExcerpt ?? "Source passage unavailable."}
                    />
                  </span>
                )}
              </div>

              <p className="mb-4 text-[17px] font-medium leading-snug text-[var(--fg-strong)]">
                {q.prompt}
              </p>

              <ul className="space-y-2">
                {q.options.map((opt) => {
                  const isChosen = chosenId === opt.id;
                  const reveal = answered && (opt.isCorrect || isChosen);
                  const tone = !answered
                    ? "idle"
                    : opt.isCorrect
                      ? "correct"
                      : isChosen
                        ? "wrong"
                        : "muted";
                  return (
                    <li key={opt.id}>
                      <button
                        type="button"
                        disabled={answered}
                        onClick={() => select(q, opt)}
                        className={[
                          "flex w-full items-center gap-3 rounded-[var(--r-sm)] border px-3 py-2.5 text-left text-sm transition-colors",
                          tone === "idle" &&
                            "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-muted)] cursor-pointer",
                          tone === "correct" &&
                            "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]",
                          tone === "wrong" &&
                            "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]",
                          tone === "muted" &&
                            "border-[var(--border)] bg-[var(--bg)] text-[var(--fg-faint)]",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className="font-mono text-xs font-semibold opacity-70">
                          {opt.label}
                        </span>
                        <span className="flex-1">{opt.content}</span>
                        {reveal && opt.isCorrect && (
                          <Check className="h-4 w-4 flex-shrink-0 text-[var(--success)]" />
                        )}
                        {reveal && isChosen && !opt.isCorrect && (
                          <X className="h-4 w-4 flex-shrink-0 text-[var(--danger)]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {answered && q.explanation && (
                <p className="mt-3 border-l-2 border-[var(--accent-border)] pl-3 text-sm italic text-[var(--fg-muted)]">
                  {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {/* Finish / score */}
      {answeredCount === questions.length ? (
        <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-6 text-center">
          {submitted ? (
            <>
              <p className="font-display text-xl font-semibold text-[var(--fg-strong)]">
                {pct >= 70 ? "Well done." : "Keep at it."}
              </p>
              <p className="mt-1 font-mono text-sm text-[var(--fg-muted)]">
                {correctCount}/{questions.length} correct — {pct}%
              </p>
              <div className="mt-5 flex justify-center">
                <Button variant="outline" onPress={reset}>
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Retake quiz
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--fg-muted)]">
                All questions answered. Reveal your score?
              </p>
              <div className="mt-4 flex justify-center">
                <Button variant="primary" onPress={() => setSubmitted(true)}>
                  See score
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="text-center font-mono text-xs text-[var(--fg-faint)]">
          Answer every question to see your score.
        </p>
      )}
    </div>
  );
}
