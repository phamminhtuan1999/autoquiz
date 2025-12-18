import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/lib/gemini";
import type { CramResult } from "@/types/cram";
import { CramModeDisplay } from "@/components/cram-mode-display";
import { RegularQuizDisplay } from "@/components/regular-quiz-display";

type QuizDetailProps = {
  params: Promise<{ quizId: string }>;
};

function isCramResult(questions: unknown): questions is CramResult {
  return (
    typeof questions === "object" &&
    questions !== null &&
    "summary" in questions &&
    "blitz_questions" in questions &&
    Array.isArray((questions as CramResult).summary) &&
    Array.isArray((questions as CramResult).blitz_questions)
  );
}

function isQuizQuestionArray(questions: unknown): questions is QuizQuestion[] {
  return (
    Array.isArray(questions) &&
    questions.length > 0 &&
    "question" in questions[0] &&
    "options" in questions[0] &&
    "answer" in questions[0]
  );
}

export default async function QuizDetailPage({ params }: QuizDetailProps) {
  const { quizId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,questions,created_at,source_filename")
    .eq("id", quizId)
    .eq("user_id", user.id)
    .single();

  if (!quiz) {
    notFound();
  }

  const isCram = isCramResult(quiz.questions);
  const isRegularQuiz = isQuizQuestionArray(quiz.questions);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12 sm:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            {isCram ? "Cram Session" : "Quiz"}
          </p>
          <h1 className="text-3xl font-bold text-slate-900">{quiz.title}</h1>
          {quiz.source_filename && (
            <p className="text-sm text-slate-500">
              Source: {quiz.source_filename}
            </p>
          )}
          <p className="text-xs text-slate-400">
            Created:{" "}
            {new Date(quiz.created_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Cram Mode Display */}
      {isCram && <CramModeDisplay cramResult={quiz.questions as CramResult} />}

      {/* Regular Quiz Display */}
      {isRegularQuiz && (
        <RegularQuizDisplay 
          questions={quiz.questions as QuizQuestion[]} 
          quizId={quizId}
        />
      )}

      {/* Fallback for unknown format */}
      {!isCram && !isRegularQuiz && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-800">
            Unable to display this quiz. The format is not recognized.
          </p>
        </div>
      )}
    </div>
  );
}
