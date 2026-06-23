"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExamTimer, useExamTimer } from "@/components/mock-exam/exam-timer";
import { MCQSection } from "@/components/mock-exam/mcq-section";
import { EssaySection } from "@/components/mock-exam/essay-section";
import { startMockExamSession, submitMockExam } from "@/actions/mock-exam-session";
import type {
  MockExam,
  MCQQuestion,
  EssayQuestion,
  EssayAnswer,
  TimerWarning,
  ExamSection,
} from "@/types/mock-exam";

export default function ExamTakingPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [exam, setExam] = useState<MockExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Exam state
  const [currentSection, setCurrentSection] = useState<ExamSection>("mcq");
  const [currentQuestion, setCurrentQuestion] = useState<number>(1);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<EssayAnswer[]>([]);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);

  const timer = useExamTimer(60);
  const hasInitialized = useRef(false);

  // Load exam data - only run once
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const loadExam = async () => {
      try {
        const response = await fetch(`/api/mock-exam/${examId}`);
        if (!response.ok) {
          throw new Error("Failed to load exam");
        }
        const data = await response.json();
        setExam(data);

        // Initialize answers if exam has them
        if (data.mcq_answers) {
          setMcqAnswers(data.mcq_answers);
        }
        if (data.essay_answers) {
          setEssayAnswers(data.essay_answers);
        }

        // Start the exam timer only if exam is in draft status
        if (data.status === "draft") {
          await startMockExamSession(examId);
        }

        setLoading(false);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      }
    };

    loadExam();
  }, [examId]);

  // Start timer after exam is loaded
  useEffect(() => {
    if (exam && !loading && !timer.isActive && !timer.isExpired) {
      timer.start();
    }
  }, [exam, loading, timer]);

  // Handle timer warning
  const handleTimerWarning = useCallback((level: TimerWarning, remainingSeconds: number) => {
    if (level === "critical") {
      // Could show a modal or enhanced warning
      console.warn("Critical time warning:", remainingSeconds);
    }
  }, []);

  // Submit exam
  const handleSubmitExam = useCallback(async (force = false) => {
    if (!force && !showSubmitConfirm) {
      setShowSubmitConfirm(true);
      return;
    }

    if (!exam) return;

    startTransition(async () => {
      try {
        await submitMockExam(examId, mcqAnswers, essayAnswers);
        router.push(`/dashboard/mock-exam/${examId}/results`);
      } catch (err) {
        setError((err as Error).message);
        setShowSubmitConfirm(false);
      }
    });
  }, [exam, examId, mcqAnswers, essayAnswers, showSubmitConfirm, router]);

  // Handle timer expiration
  const handleTimeExpired = useCallback(() => {
    setTimeExpired(true);
    handleSubmitExam(true);
  }, [handleSubmitExam]);

  // Handle MCQ answer change
  const handleMCQAnswerChange = useCallback((questionId: number, answer: string) => {
    setMcqAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));

    // Save to server periodically
    startTransition(async () => {
      try {
        const { saveMCQAnswers } = await import("@/actions/mock-exam-session");
        await saveMCQAnswers(examId, { ...mcqAnswers, [questionId]: answer });
      } catch (err) {
        console.error("Failed to save MCQ answers:", err);
      }
    });
  }, [examId, mcqAnswers]);

  // Handle essay answer change
  const handleEssayAnswerChange = useCallback((answers: EssayAnswer[]) => {
    setEssayAnswers(answers);

    // Save to server periodically
    startTransition(async () => {
      try {
        const { saveEssayAnswers } = await import("@/actions/mock-exam-session");
        await saveEssayAnswers(examId, answers);
      } catch (err) {
        console.error("Failed to save essay answers:", err);
      }
    });
  }, [examId]);



  // Navigate questions
  const handleQuestionChange = useCallback((questionId: number) => {
    setCurrentQuestion(questionId);

    // Switch section if needed
    const mcqQuestions = exam?.mcq_questions as MCQQuestion[];
    if (mcqQuestions && questionId > Math.max(...mcqQuestions.map(q => q.id))) {
      setCurrentSection("essay");
    } else {
      setCurrentSection("mcq");
    }
  }, [exam]);

  // Get current question data
  const getCurrentQuestionData = useCallback(() => {
    if (!exam) return null;

    const mcqQuestions = exam.mcq_questions as MCQQuestion[];
    const essayQuestions = exam.essay_questions as EssayQuestion[];

    if (currentSection === "mcq") {
      return mcqQuestions.find(q => q.id === currentQuestion);
    } else {
      return essayQuestions.find(q => q.id === currentQuestion);
    }
  }, [exam, currentSection, currentQuestion]);

  // Calculate progress
  const getProgress = useCallback(() => {
    if (!exam) return { mcq: 0, essay: 0, total: 0 };

    const mcqAnswered = Object.keys(mcqAnswers).length;
    const essayAnswered = essayAnswers.filter(a => a.text.trim().length > 0).length;

    return {
      mcq: mcqAnswered,
      essay: essayAnswered,
      total: mcqAnswered + essayAnswered,
    };
  }, [exam, mcqAnswers, essayAnswers]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Exam Error
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {error || "Exam not found"}
          </p>
          <button
            onClick={() => router.push("/dashboard/mock-exam")}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
          >
            Back to Mock Exams
          </button>
        </div>
      </div>
    );
  }

  const mcqQuestions = exam.mcq_questions as MCQQuestion[];
  const essayQuestions = exam.essay_questions as EssayQuestion[];
  const progress = getProgress();
  const currentQuestionData = getCurrentQuestionData();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {exam.title}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Mock Exam • 60 minutes • 32 questions total
              </p>
            </div>

            {/* Timer */}
            <ExamTimer
              totalMinutes={60}
              onTimeExpired={handleTimeExpired}
              onWarning={handleTimerWarning}
              isActive={timer.isActive}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-xl border-2 border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700 sticky top-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Exam Progress</h3>

              {/* Section Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setCurrentSection("mcq")}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${currentSection === "mcq"
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400"
                    }
                  `}
                >
                  MCQ ({progress.mcq}/{mcqQuestions.length})
                </button>
                <button
                  onClick={() => setCurrentSection("essay")}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    {currentSection === "essay"
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400"
                    }
                  `}
                >
                  Essays ({progress.essay}/{essayQuestions.length})
                </button>
              </div>

              {/* Progress Stats */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Questions Answered</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {progress.total}/32
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Time Spent</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {Math.floor(timer.elapsedSeconds / 60)}m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Time Remaining</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {Math.floor(timer.timeRemaining / 60)}m
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={() => handleSubmitExam()}
                disabled={progress.total === 0}
                className="w-full mt-6 px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                Submit Exam
              </button>
            </div>
          </aside>

          {/* Question Area */}
          <div className="lg:col-span-3">
            {currentSection === "mcq" && currentQuestionData && (
              <MCQSection
                questions={mcqQuestions}
                answers={mcqAnswers}
                onAnswerChange={handleMCQAnswerChange}
                currentQuestion={currentQuestion}
                onQuestionChange={handleQuestionChange}
              />
            )}

            {currentSection === "essay" && currentQuestionData && (
              <EssaySection
                questions={essayQuestions}
                answers={essayAnswers}
                onAnswerChange={handleEssayAnswerChange}
                currentQuestion={currentQuestion}
                onQuestionChange={handleQuestionChange}
                timeRemaining={timer.timeRemaining}
              />
            )}
          </div>
        </div>
      </main>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 dark:bg-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Submit Exam?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              You&apos;ve answered {progress.total} out of 32 questions. Are you sure you want to submit? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors dark:bg-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmitExam(true)}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Expired Modal */}
      {timeExpired && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 dark:bg-slate-800">
            <div className="text-center">
              <div className="text-6xl mb-4">⏰</div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                Time&apos;s Up!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Your exam time has expired. Submitting your current answers...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}