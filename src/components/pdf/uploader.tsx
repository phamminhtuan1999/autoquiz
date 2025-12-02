"use client";

import { useState, useTransition, useEffect, type ChangeEvent } from "react";
import type { QuizQuestion, Difficulty } from "@/lib/gemini";
import { generateQuiz } from "@/actions/generate-quiz";
import { extractTextFromPdf } from "@/utils/pdf";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { QuizTest } from "@/components/quiz/test";
import { QuizResults } from "@/components/quiz/results";
import { CramButton } from "@/components/cram-button";

export function PdfUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [progress, setProgress] = useState<number>(0);
  const [quizMode, setQuizMode] = useState<"preview" | "test">("test");
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState<boolean>(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    setFile(nextFile ?? null);
    setQuiz(null);
    setError(null);
    setUserAnswers({});
    setShowResults(false);
    setQuizMode("test");
    setStatus(nextFile ? `Selected ${nextFile.name}` : "");
  };

  const handleGenerate = () => {
    if (!file) {
      setError("Upload a PDF first");
      return;
    }

    if (!user) {
      setError("Please sign in to generate quizzes");
      return;
    }

    startTransition(async () => {
      setStatus("Extracting PDF text...");
      setProgress(10);
      setError(null);

      try {
        const documentText = await extractTextFromPdf(file);
        setProgress(30);
        setStatus("Generating quiz questions...");
        
        const nextQuiz = await generateQuiz({
          documentText,
          title: file.name.replace(/\.pdf$/i, ""),
          questionCount,
          difficulty,
        });
        
        setProgress(100);
        setQuiz(nextQuiz);
        setStatus("Quiz ready!");
        // Reset test state when new quiz is generated
        setUserAnswers({});
        setShowResults(false);
        setQuizMode("test");
      } catch (err) {
        setError((err as Error).message);
        setStatus("");
        setProgress(0);
      }
    });
  };

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const handleSubmitTest = () => {
    setShowResults(true);
  };

  const handleRetakeTest = () => {
    setUserAnswers({});
    setShowResults(false);
  };

  const handleBackToPreview = () => {
    setQuizMode("preview");
    setShowResults(false);
  };

  if (authLoading) {
    return (
      <section className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            1. Upload your document
          </h2>
          <p className="text-sm text-slate-500">
            PDFs up to 15 MB, extracted fully in the browser.
          </p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            Please sign in to generate quizzes. Use the sign in button above.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          1. Upload your document
        </h2>
        <p className="text-sm text-slate-500">
          PDFs up to 15 MB, extracted fully in the browser.
        </p>
      </div>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="block w-full rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-600"
      />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="question-count" className="block text-sm font-medium text-slate-700 mb-1">
            Number of Questions
          </label>
          <select
            id="question-count"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-indigo-500"
          >
            {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="difficulty" className="block text-sm font-medium text-slate-700 mb-1">
            Difficulty Level
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
      
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending || !file}
        className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Generating…" : "Generate Quiz"}
      </button>

      {/* Cram Mode Button - Premium 3-Credit Feature */}
      <CramButton file={file} disabled={isPending} />

      {progress > 0 && progress < 100 && (
        <div className="w-full">
          <div className="flex justify-between text-sm text-slate-600 mb-1">
            <span>{status}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      {status && progress === 0 && (
        <p className="text-sm font-medium text-slate-600">{status}</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {quiz && (
        <div className="space-y-4">
          {/* Mode Selector Tabs */}
          <div className="border-b border-slate-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setQuizMode("test")}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  quizMode === "test"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                Test Mode
              </button>
              <button
                onClick={() => setQuizMode("preview")}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  quizMode === "preview"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                Preview
              </button>
            </nav>
          </div>

          {/* Content based on mode */}
          {quizMode === "test" && !showResults && (
            <QuizTest
              questions={quiz}
              userAnswers={userAnswers}
              onAnswerChange={handleAnswerChange}
              onSubmit={handleSubmitTest}
              isSubmitting={false}
            />
          )}

          {quizMode === "preview" && !showResults && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900">Preview</h3>
              <ol className="space-y-3">
                {quiz.map((item, index) => (
                  <li
                    key={index}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <p className="font-medium text-slate-900">
                      {index + 1}. {item.question}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600">
                      {item.options.map((option, optionIndex) => (
                        <li key={optionIndex}>{option}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm text-green-600">
                      Answer: {item.answer}
                    </p>
                    {item.explanation && (
                      <p className="text-sm text-slate-500">
                        Why: {item.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {showResults && (
            <QuizResults
              questions={quiz}
              userAnswers={userAnswers}
              onRetakeTest={handleRetakeTest}
              onBackToPreview={handleBackToPreview}
            />
          )}
        </div>
      )}
    </section>
  );
}
