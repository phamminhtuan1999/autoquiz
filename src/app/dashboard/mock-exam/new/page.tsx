"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/react";
import { PdfMultiSelector } from "@/components/mock-exam/pdf-multi-selector";
import { generateMockExam } from "@/actions/generate-mock-exam";
import type { GenerateMockExamInput } from "@/types/mock-exam";

export default function NewMockExamPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [documents, setDocuments] = useState<{ filename: string; text: string }[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [difficulty, setDifficulty] = useState<"standard" | "challenging">("standard");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const handleGenerate = () => {
    if (documents.length === 0) {
      setError("Select at least one PDF document.");
      return;
    }
    if (!examTitle.trim()) {
      setError("Provide a title for the exam.");
      return;
    }

    startTransition(async () => {
      setProgress("Initializing exam generation…");
      setError(null);
      try {
        const input: GenerateMockExamInput = {
          documentTexts: documents,
          title: examTitle,
          difficulty,
        };
        setProgress("Creating exam questions…");
        const result = await generateMockExam(input);
        setProgress("Finalizing…");
        router.push(`/dashboard/mock-exam/${result.examId}`);
      } catch (err) {
        setError((err as Error).message);
        setProgress("");
      }
    });
  };

  const canGenerate =
    documents.length >= 1 && documents.every((d) => d.text) && examTitle.trim() && !isPending;

  const totalChars = documents.reduce((s, d) => s + d.text.length, 0);
  const estSeconds = Math.max(30, Math.ceil(totalChars / 15000));
  const hasPreview = documents.length > 0 && documents.every((d) => d.text);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12 sm:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg-strong)]">New mock exam</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">60-minute timed exam from your documents. Costs 5 credits.</p>
        </div>
        <Link href="/dashboard/mock-exam" className="text-sm text-[var(--accent)] hover:underline">
          Cancel
        </Link>
      </div>

      <div className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="exam-title" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
            Title
          </label>
          <input
            id="exam-title"
            type="text"
            value={examTitle}
            onChange={(e) => setExamTitle(e.target.value)}
            placeholder="e.g., Midterm — Biology 101"
            disabled={isPending}
            className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent-border)] disabled:opacity-50"
          />
        </div>

        {/* Documents */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
            Source documents
          </label>
          <PdfMultiSelector onDocumentsChange={setDocuments} disabled={isPending} />
        </div>

        {/* Difficulty */}
        <div>
          <label htmlFor="difficulty" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
            Difficulty
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "standard" | "challenging")}
            disabled={isPending}
            className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent-border)] disabled:opacity-50"
          >
            <option value="standard">Standard — comprehensive coverage</option>
            <option value="challenging">Challenging — advanced critical thinking</option>
          </select>
        </div>
      </div>

      {/* Preview */}
      {hasPreview && (
        <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-subtle)] p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Exam preview</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <ul className="space-y-1 text-[var(--fg-muted)]">
              <li>{documents.length} document{documents.length !== 1 ? "s" : ""}</li>
              <li>{totalChars.toLocaleString()} characters</li>
              <li>30 MCQs + 2 essays</li>
              <li>60-minute timer</li>
            </ul>
            <ul className="space-y-1 text-[var(--fg-muted)]">
              <li>5 credits</li>
              <li>~{estSeconds}s to generate</li>
              <li>AI-graded</li>
              <li>Detailed feedback</li>
            </ul>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-[var(--r-sm)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2.5 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {/* Progress */}
      {progress && (
        <div className="flex items-center gap-2 rounded-[var(--r-sm)] border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-2.5 text-sm text-[var(--info)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--info)] border-t-transparent" />
          {progress}
        </div>
      )}

      <Button
        variant="primary"
        onPress={handleGenerate}
        isDisabled={!canGenerate}
        className="w-full"
      >
        {isPending ? "Generating…" : "Generate exam — 5 credits"}
      </Button>

      {/* How it works */}
      <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-subtle)] p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">How it works</p>
        <div className="grid grid-cols-2 gap-4 text-sm text-[var(--fg-muted)]">
          <ul className="space-y-1.5">
            <li>Use academic PDFs, not scanned images</li>
            <li>Pick documents on related topics</li>
            <li>You need 5 credits in your account</li>
          </ul>
          <ul className="space-y-1.5">
            <li>30 MCQs with explanations</li>
            <li>2 essays with grading rubrics</li>
            <li>AI-powered grading and feedback</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
