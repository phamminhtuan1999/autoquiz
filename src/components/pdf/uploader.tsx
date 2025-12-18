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
import { ClayCard } from "@/components/ui/clay-card";

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
    <ClayCard className="w-full max-w-3xl mx-auto border-4 border-white/60 bg-white/90 backdrop-blur-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-100 text-3xl shadow-sm rotate-3">
          📂
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Upload your document
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          PDFs up to 15 MB. We'll turn it into a fun quiz!
        </p>
      </div>

      <div className="space-y-6">
        {/* File Input */}
        <div className="relative group">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="absolute inset-0 z-10 w-full h-full cursor-pointer opacity-0"
          />
          <div className={`
            flex flex-col items-center justify-center rounded-2xl border-3 border-dashed px-6 py-10 transition-all duration-300
            ${file 
              ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20" 
              : "border-slate-300 bg-slate-50/50 hover:border-indigo-300 hover:bg-slate-100/50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-slate-500"
            }
          `}>
            {file ? (
              <>
                <div className="mb-2 text-4xl">📄</div>
                <p className="font-bold text-indigo-700 dark:text-indigo-300">
                  {file.name}
                </p>
                <p className="text-xs font-semibold text-indigo-400 dark:text-indigo-500 mt-1">
                  Click to change file
                </p>
              </>
            ) : (
              <>
                <div className="mb-2 text-4xl opacity-50 group-hover:scale-110 transition-transform duration-300">
                  📥
                </div>
                <p className="font-bold text-slate-600 dark:text-slate-300">
                  Drop your PDF here
                </p>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
                  or click to browse
                </p>
              </>
            )}
          </div>
        </div>
        
        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="question-count" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Questions
            </label>
            <div className="relative">
              <select
                id="question-count"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full appearance-none rounded-xl border-2 border-indigo-100 bg-white px-4 py-3 font-bold text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900"
              >
                {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num} Questions
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400">
                ▼
              </div>
            </div>
          </div>
          
          <div>
            <label htmlFor="difficulty" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Difficulty
            </label>
            <div className="relative">
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full appearance-none rounded-xl border-2 border-indigo-100 bg-white px-4 py-3 font-bold text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900"
              >
                <option value="easy">🐣 Easy</option>
                <option value="medium">🦁 Medium</option>
                <option value="hard">🦖 Hard</option>
                <option value="extreme">🌋 Extremely Hard</option>
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400">
                ▼
              </div>
            </div>
          </div>
        </div>
        
        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending || !file}
            className="clay-button w-full justify-center !text-lg !py-4"
          >
            {isPending ? "✨ Working Magic..." : "✨ Generate Quiz"}
          </button>

          <CramButton file={file} disabled={isPending} />
        </div>

        {/* Progress Bar */}
        {(progress > 0 || status) && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>{status || "Ready"}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 inner-shadow">
              <div
                className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 transition-all duration-500 ease-out relative overflow-hidden"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="rounded-xl border-2 border-red-100 bg-red-50 p-4 text-center text-sm font-bold text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 animate-in shake">
            ❌ {error}
          </div>
        )}
      </div>

      {quiz && (
        <div className="mt-8 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="h-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Mode Selector Tabs */}
          <div className="flex justify-center gap-2 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800">
            <button
              onClick={() => setQuizMode("test")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                quizMode === "test"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              📝 Take Quiz
            </button>
            <button
              onClick={() => setQuizMode("preview")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                quizMode === "preview"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              👀 Preview Answers
            </button>
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
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Answer Key</h3>
              <div className="space-y-4">
                {quiz.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border-2 border-slate-100 bg-white p-5 dark:bg-slate-800 dark:border-slate-700"
                  >
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      <span className="mr-2 inline-block rounded-lg bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">#{index + 1}</span>
                      {item.question}
                    </p>
                    <ul className="mt-3 space-y-2 pl-2">
                      {item.options.map((option, optionIndex) => (
                        <li key={optionIndex} className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                          <div className="mr-3 h-1.5 w-1.5 rounded-full bg-slate-300"></div>
                          {option}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 rounded-xl bg-green-50 p-3 dark:bg-green-900/20">
                      <p className="text-sm font-bold text-green-700 dark:text-green-400">
                        ✅ Answer: {item.answer}
                      </p>
                      {item.explanation && (
                        <p className="mt-1 text-xs text-green-600/80 dark:text-green-400/80">
                          Why? {item.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
    </ClayCard>
  );
}
