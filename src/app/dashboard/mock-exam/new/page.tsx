"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
        router.push(`/dashboard/mock-exam/${result.examId}`);
      } catch (err) {
        setError((err as Error).message);
        setProgress("");
      }
    });
  };

  const canGenerate = documents.length >= 1 && documents.every(doc => doc.text) && examTitle.trim() && !isPending;

  const getTotalCharacters = () => {
    return documents.reduce((sum, doc) => sum + doc.text.length, 0);
  };

  const getEstimatedTime = () => {
    const charCount = getTotalCharacters();
    // Rough estimate: ~15K chars per minute of processing
    return Math.max(30, Math.ceil(charCount / 15000));
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-4 py-12 sm:px-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Create Mock Exam
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Combine your lecture PDFs into a comprehensive timed exam
        </p>
      </div>

      {/* Form */}
      <div className="space-y-8">
        {/* Title Input */}
        <div>
          <label htmlFor="exam-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Exam Title
          </label>
          <input
            id="exam-title"
            type="text"
            value={examTitle}
            onChange={(e) => setExamTitle(e.target.value)}
            placeholder="e.g., Midterm Exam: Biology 101"
            className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800 dark:border-slate-700 dark:focus:border-indigo-500"
          />
        </div>

        {/* PDF Selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select PDF Documents
          </label>
          <PdfMultiSelector
            onDocumentsChange={setDocuments}
            disabled={isPending}
          />
        </div>

        {/* Difficulty Level */}
        <div>
          <label htmlFor="difficulty" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Exam Difficulty
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "standard" | "challenging")}
            disabled={isPending}
            className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800 dark:border-slate-700 dark:focus:border-indigo-500"
          >
            <option value="standard">📚 Standard - Comprehensive coverage of material</option>
            <option value="challenging">🔥 Challenging - Advanced critical thinking questions</option>
          </select>
        </div>

        {/* Exam Preview */}
        {documents.length > 0 && documents.every(doc => doc.text) && (
          <div className="bg-slate-50 rounded-xl p-6 dark:bg-slate-800/50">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              Exam Preview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">📚 Content</h4>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <li>• {documents.length} PDF document{documents.length !== 1 ? 's' : ''}</li>
                  <li>• {getTotalCharacters().toLocaleString()} total characters</li>
                  <li>• 60-minute time limit</li>
                  <li>• 30 Multiple Choice Questions</li>
                  <li>• 2 Essay Questions with rubrics</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">💰 Cost & Time</h4>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <li>• <span className="font-bold">5 credits</span> to generate</li>
                  <li>• ~{getEstimatedTime()} seconds to process</li>
                  <li>• AI-powered grading included</li>
                  <li>• Detailed feedback report</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 p-4 bg-indigo-50 rounded-lg dark:bg-indigo-900/20">
              <p className="text-sm text-indigo-800 dark:text-indigo-300">
                <span className="font-bold">AI will create:</span> Questions that test comprehension, critical thinking, and application of concepts across all selected materials.
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            ❌ {error}
          </div>
        )}

        {/* Progress Display */}
        {progress && (
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-center text-sm text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
            <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
            {progress}
          </div>
        )}

        {/* Generate Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`
              px-8 py-4 rounded-xl font-bold text-lg transition-all
              ${canGenerate
                ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }
            `}
          >
            {isPending ? "🎓 Generating Exam..." : "✨ Generate Mock Exam"}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-slate-50 rounded-xl p-6 dark:bg-slate-800/50">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
          📖 How It Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600 dark:text-slate-400">
          <div className="space-y-3">
            <h4 className="font-medium text-slate-700 dark:text-slate-300">Before You Start</h4>
            <ul className="space-y-2">
              <li>• Choose clear, academic PDFs with relevant content</li>
              <li>• Ensure documents are readable (not scanned images)</li>
              <li>• Select materials that cover related topics</li>
              <li>• Check you have at least 5 credits available</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-slate-700 dark:text-slate-300">What You&apos;ll Get</h4>
            <ul className="space-y-2">
              <li>• 30 multiple choice questions with explanations</li>
              <li>• 2 essay questions with detailed grading rubrics</li>
              <li>• 60-minute timer with progress tracking</li>
              <li>• AI-powered grading with personalized feedback</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="text-center">
        <Link
          href="/dashboard/mock-exam"
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          ← Back to Mock Exam Center
        </Link>
      </div>
    </div>
  );
}