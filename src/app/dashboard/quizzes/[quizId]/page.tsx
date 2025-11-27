import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/lib/gemini";

type QuizDetailProps = {
  params: { quizId: string };
};

export default async function QuizDetailPage({ params }: QuizDetailProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,questions")
    .eq("id", params.quizId)
    .eq("user_id", user.id)
    .single();

  if (!quiz) {
    notFound();
  }

  const questions = quiz.questions as QuizQuestion[];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Quiz
        </p>
        <h1 className="text-3xl font-bold text-slate-900">{quiz.title}</h1>
      </div>
      <ol className="space-y-4">
        {questions.map((question, index) => (
          <li
            key={question.question}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-base font-semibold text-slate-900">
              {index + 1}. {question.question}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {question.options.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-semibold text-emerald-600">
              Answer: {question.answer}
            </p>
            {question.explanation && (
              <p className="text-sm text-slate-500">
                Why: {question.explanation}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
