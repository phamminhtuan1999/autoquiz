"use client";

import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { Flashcard } from "./flashcard";
import { SourceRef } from "./source-ref";
import { DifficultyChip, type Difficulty } from "./difficulty-chip";
import { recordRagAttempt } from "@/actions/record-rag-attempt";

export type CramCard = {
  id: string;
  front: string;
  back: string;
  difficulty: string | null;
  topic: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  sourceExcerpt: string | null;
};

const DIFFICULTY_LABEL: Record<string, Difficulty> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/**
 * US-RAG-009b: cited flashcard player for a `mode='cram'` quiz_set. One card at
 * a time — flip to reveal the back, then self-rate "Got it" / "Still learning".
 * Each rating records a best-effort `rag_question_attempts` row (US-RAG-008b,
 * `selected_option_id=null`, `is_correct` = the rating) and advances. The source
 * citation rides in the card chrome (a popover, so it does not spoil recall).
 */
export function RagCramPlayer({
  quizSetId,
  cards,
}: {
  quizSetId: string;
  cards: CramCard[];
}) {
  // cardId -> knew it (true) / still learning (false). "rated" once present.
  const [ratings, setRatings] = useState<Record<string, boolean>>({});
  const [index, setIndex] = useState(0);

  const ratedCount = Object.keys(ratings).length;
  const knewCount = useMemo(
    () => Object.values(ratings).filter(Boolean).length,
    [ratings]
  );
  const done = ratedCount === cards.length;
  const card = cards[Math.min(index, cards.length - 1)];

  const rate = (c: CramCard, knewIt: boolean) => {
    if (ratings[c.id] === undefined) {
      void recordRagAttempt({
        questionId: c.id,
        quizSetId,
        selectedOptionId: null,
        isCorrect: knewIt,
      });
    }
    setRatings((prev) => ({ ...prev, [c.id]: knewIt }));
    setIndex((i) => Math.min(i + 1, cards.length - 1));
  };

  const reset = () => {
    setRatings({});
    setIndex(0);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pct = cards.length ? Math.round((knewCount / cards.length) * 100) : 0;
  const diff = card?.difficulty ? DIFFICULTY_LABEL[card.difficulty] : undefined;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
            style={{ width: `${(ratedCount / cards.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-[var(--fg-muted)]">
          {ratedCount}/{cards.length} studied
        </span>
      </div>

      {done ? (
        <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-6 text-center">
          <p className="font-display text-xl font-semibold text-[var(--fg-strong)]">
            {pct >= 70 ? "Strong recall." : "Keep reviewing."}
          </p>
          <p className="mt-1 font-mono text-sm text-[var(--fg-muted)]">
            You knew {knewCount} of {cards.length} — {pct}%
          </p>
          <div className="mt-5 flex justify-center">
            <Button variant="outline" onPress={reset}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Study again
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[var(--fg-faint)]">
              Card {index + 1} of {cards.length}
            </span>
            {diff && <DifficultyChip difficulty={diff} />}
            {card.topic && (
              <span className="font-mono text-xs text-[var(--fg-faint)]">
                {card.topic}
              </span>
            )}
            {(card.sourcePageStart != null || card.sourceExcerpt) && (
              <span className="ml-auto">
                <SourceRef
                  page={card.sourcePageStart ?? undefined}
                  passage={card.sourceExcerpt ?? "Source passage unavailable."}
                />
              </span>
            )}
          </div>

          <Flashcard
            key={card.id}
            front={card.front}
            back={card.back}
            onGotIt={() => rate(card, true)}
            onStillLearning={() => rate(card, false)}
          />
        </div>
      )}
    </div>
  );
}
