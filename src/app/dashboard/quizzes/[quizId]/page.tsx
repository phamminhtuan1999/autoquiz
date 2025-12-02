import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/lib/gemini";
import type { CramResult, GoldenNugget, BlitzQuestion } from "@/types/cram";

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
        <RegularQuizDisplay questions={quiz.questions as QuizQuestion[]} />
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

function CramModeDisplay({ cramResult }: { cramResult: CramResult }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Golden Nuggets */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>📝</span>
            Golden Nuggets
          </h2>
          <span className="text-sm text-slate-500 font-medium">
            {cramResult.summary.length} Facts
          </span>
        </div>
        <div className="space-y-3">
          {cramResult.summary.map((nugget: GoldenNugget, index) => (
            <div
              key={index}
              className="border border-orange-200 bg-orange-50/50 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">
                    {nugget.topic}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {nugget.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blitz Questions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>⚡</span>
            Blitz Flashcards
          </h2>
          <span className="text-sm text-slate-500 font-medium">
            {cramResult.blitz_questions.length} Questions
          </span>
        </div>
        <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
          {cramResult.blitz_questions.map((card: BlitzQuestion, index) => (
            <div key={index} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm mb-2">
                    {card.question}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <p className="text-sm text-slate-700 bg-slate-50 rounded p-2">
                      <strong className="text-slate-900">Answer:</strong>{" "}
                      {card.answer}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RegularQuizDisplay({ questions }: { questions: QuizQuestion[] }) {
  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {questions.map((question, index) => (
          <li
            key={index}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-base font-semibold text-slate-900">
              {index + 1}. {question.question}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {question.options.map((option, optionIndex) => (
                <li key={optionIndex}>{option}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-semibold text-emerald-600">
              Answer: {question.answer}
            </p>
            {question.explanation && (
              <p className="mt-2 text-sm text-slate-500">
                <strong>Why:</strong> {question.explanation}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
