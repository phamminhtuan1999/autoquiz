"use client";

import { useState } from "react";
import { Button } from "@heroui/react";

interface FlashcardProps {
  front: string;
  back: string;
  onGotIt?: () => void;
  onStillLearning?: () => void;
}

export function Flashcard({ front, back, onGotIt, onStillLearning }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="group relative min-h-[220px] w-full cursor-pointer rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-8 text-left shadow-sm transition-all hover:border-[var(--border-strong)] hover:shadow-md active:scale-[0.99]"
        aria-label={flipped ? "Show question" : "Show answer"}
      >
        <span className="absolute right-4 top-4 font-mono text-xs text-[var(--fg-faint)]">
          {flipped ? "answer" : "question — tap to flip"}
        </span>
        <p className={`text-[17px] font-medium leading-snug ${flipped ? "text-[var(--fg-strong)]" : "text-[var(--fg)]"}`}>
          {flipped ? back : front}
        </p>
      </button>

      {flipped && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            onPress={() => { setFlipped(false); onStillLearning?.(); }}
            className="flex-1"
          >
            Still learning
          </Button>
          <Button
            variant="primary"
            onPress={() => { setFlipped(false); onGotIt?.(); }}
            className="flex-1"
          >
            Got it
          </Button>
        </div>
      )}
    </div>
  );
}
