"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PdfMultiSelector } from "@/components/mock-exam/pdf-multi-selector";
import { generateMockExam } from "@/actions/generate-mock-exam";
import type { GenerateMockExamInput } from "@/types/mock-exam";

interface MockExamButtonProps {
  files: File[];
  disabled?: boolean;
  className?: string;
}

export function MockExamButton({ files, disabled = false, className = "" }: MockExamButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [documents, setDocuments] = useState<{ filename: string; text: string }[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [difficulty, setDifficulty] = useState<"standard" | "challenging">("standard");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const handleGenerate = () => {
    if (documents.length === 0) {
      setError("Please select at least one PDF document");
      return;
    }

    if (!examTitle.trim()) {
      setError("Please provide a title for the mock exam");
      return;
    }

    startTransition(async () => {
      setProgress("Initializing exam generation...");
      setError(null);

      try {
        const input: GenerateMockExamInput = {
          documentTexts: documents,
          title: examTitle,
          difficulty,
        };

        setProgress("Creating comprehensive exam questions...");
        const result = await generateMockExam(input);

        setProgress("Finalizing exam setup...");
        setShowModal(false);
        router.push(`/dashboard/mock-exam/${result.examId}`);
      } catch (err) {
        setError((err as Error).message);
        setProgress("");
      }
    });
  };

  const canGenerate = documents.length >= 1 && documents.every(doc => doc.text) && examTitle.trim() && !isPending;

  // Auto-generate title from files
  const generateSuggestedTitle = () => {
    if (documents.length > 0) {
      const baseNames = documents.map(doc => doc.filename.replace(/\.pdf$/i, ""));
      if (baseNames.length === 1) {
        return `Mock Exam: ${baseNames[0]}`;
      } else if (baseNames.length <= 3) {
        return `Mock Exam: ${baseNames.join(" + ")}`;
      } else {
        return `Mock Exam: ${baseNames[0]} + ${baseNames.length - 1} more`;
      }
    }
    return "";
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={disabled || files.length === 0}
        className={`
          w-full justify-center !py-3 !text-base font-bold
          ${disabled || files.length === 0
            ? "opacity-50 cursor-not-allowed"
            : "hover:shadow-lg"
          }
          ${className}
        `}
      >
        🎓 {files.length === 0 ? "Select PDFs for Mock Exam" : `Generate Mock Exam (${files.length} PDF${files.length !== 1 ? 's' : ''})`}
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 dark:bg-slate-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Create Mock Exam
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ×
              </button>
            </div>

            {/* PDF Selector */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Select PDF Documents
                </label>
                <PdfMultiSelector
                  onDocumentsChange={setDocuments}
                  disabled={isPending}
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Exam Title
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder={generateSuggestedTitle() || "e.g., Midterm Exam: Biology 101"}
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-700 dark:border-slate-600 dark:focus:border-indigo-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Cost: 5 credits • 60 minutes • 30 MCQs + 2 Essays
                </p>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Exam Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as "standard" | "challenging")}
                  disabled={isPending}
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-700 dark:border-slate-600 dark:focus:border-indigo-500"
                >
                  <option value="standard">📚 Standard - Comprehensive coverage</option>
                  <option value="challenging">🔥 Challenging - Advanced critical thinking</option>
                </select>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800">
                  ❌ {error}
                </div>
              )}

              {/* Progress */}
              {progress && (
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/20 dark:border-blue-800">
                  <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                  {progress}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors dark:bg-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`
                    flex-1 px-4 py-3 rounded-lg font-bold transition-all
                    ${canGenerate
                      ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg hover:shadow-xl"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }
                  `}
                >
                  {isPending ? "🎓 Generating..." : "✨ Generate Mock Exam"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}