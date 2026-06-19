"use client";

import { useState } from "react";
import { Button, Chip, Slider } from "@heroui/react";

type OutputType = "quiz" | "flashcards" | "practice-test" | "answer-key";
type Difficulty = "Easy" | "Medium" | "Hard";

interface GenerateWizardProps {
  onGenerate: (opts: {
    outputTypes: OutputType[];
    difficultyMix: Record<Difficulty, number>;
    strictGrounding: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const OUTPUT_LABELS: Record<OutputType, string> = {
  quiz: "Quiz",
  flashcards: "Flashcards",
  "practice-test": "Practice Test",
  "answer-key": "Answer Key",
};

export function GenerateWizard({
  onGenerate,
  isLoading,
  file,
  onFileChange,
}: GenerateWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [outputTypes, setOutputTypes] = useState<OutputType[]>(["quiz"]);
  const [easyPct, setEasyPct] = useState(33);
  const [mediumPct, setMediumPct] = useState(34);
  const [hardPct] = useState(33);
  const [strictGrounding, setStrictGrounding] = useState(true);

  function toggleOutput(type: OutputType) {
    setOutputTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleGenerate() {
    setStep(3);
    await onGenerate({
      outputTypes,
      difficultyMix: { Easy: easyPct, Medium: mediumPct, Hard: hardPct },
      strictGrounding,
    });
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors ${
                step >= s
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "bg-[var(--bg-muted)] text-[var(--fg-subtle)]"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`h-px w-8 transition-colors ${
                  step > s ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-[var(--fg-muted)]">
          {step === 1 ? "Upload source" : step === 2 ? "Configure output" : "Generating…"}
        </span>
      </div>

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border-2 border-dashed border-[var(--border)] bg-[var(--bg-subtle)] transition-colors hover:border-[var(--accent-border)]">
            <span className="text-2xl text-[var(--fg-faint)]">↑</span>
            <span className="text-sm font-medium text-[var(--fg-muted)]">
              {file ? file.name : "Drop a PDF or click to browse"}
            </span>
            {file && (
              <span className="font-mono text-xs text-[var(--fg-faint)]">
                {(file.size / 1024 / 1024).toFixed(1)} MB · ready
              </span>
            )}
            <input
              type="file"
              accept=".pdf"
              className="sr-only"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button
            variant="primary"
            isDisabled={!file}
            onPress={() => setStep(2)}
            className="w-full"
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 2 — Configure */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
              Generate
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OUTPUT_LABELS) as OutputType[]).map((type) => (
                <Chip
                  key={type}
                  color={outputTypes.includes(type) ? "accent" : "default"}
                  variant={outputTypes.includes(type) ? "primary" : "secondary"}
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => toggleOutput(type)}
                >
                  {OUTPUT_LABELS[type]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
              Difficulty mix
            </p>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm">
                <span className="text-[var(--fg-muted)]">Easy</span>
                <span className="font-mono text-xs text-[var(--fg-subtle)]">{easyPct}%</span>
              </label>
              <Slider
                value={easyPct}
                onChange={(v) => setEasyPct(Array.isArray(v) ? v[0] : v)}
                minValue={0}
                maxValue={100}
                step={5}
                aria-label="Easy %"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-sm">
                <span className="text-[var(--fg-muted)]">Medium</span>
                <span className="font-mono text-xs text-[var(--fg-subtle)]">{mediumPct}%</span>
              </label>
              <Slider
                value={mediumPct}
                onChange={(v) => setMediumPct(Array.isArray(v) ? v[0] : v)}
                minValue={0}
                maxValue={100}
                step={5}
                aria-label="Medium %"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">Strict source grounding</p>
              <p className="text-xs text-[var(--fg-muted)]">Only generate from your document</p>
            </div>
            <input
              type="checkbox"
              checked={strictGrounding}
              onChange={(e) => setStrictGrounding(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </label>

          <div className="flex gap-3">
            <Button variant="ghost" size="sm" onPress={() => setStep(1)}>
              Back
            </Button>
            <Button
              variant="primary"
              isDisabled={outputTypes.length === 0}
              onPress={handleGenerate}
              className="flex-1"
            >
              Generate
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Progress */}
      {step === 3 && (
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--fg)]">
              {isLoading ? "Drafting questions…" : "Done. Sending to review queue."}
            </p>
            <p className="text-xs text-[var(--fg-muted)]">
              Reading source · Drafting questions · Scoring confidence
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
