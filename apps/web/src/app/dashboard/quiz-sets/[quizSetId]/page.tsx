import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  RagQuizPlayer,
  type PlayerQuestion,
} from "@/components/quiz/rag-quiz-player";

export const dynamic = "force-dynamic";

type QuizSetPageProps = {
  params: Promise<{ quizSetId: string }>;
};

type QuestionRow = {
  id: string;
  prompt: string;
  difficulty: string | null;
  topic: string | null;
  explanation: string | null;
  correct_answer: string | null;
  source_page_start: number | null;
  source_page_end: number | null;
  source_excerpt: string | null;
  created_at: string;
  answer_options: {
    id: string;
    label: string;
    content: string;
    is_correct: boolean;
  }[];
};

export default async function QuizSetPage({ params }: QuizSetPageProps) {
  const { quizSetId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: quizSet } = await supabase
    .from("quiz_sets")
    .select("id,title,mode,difficulty,status,created_at")
    .eq("id", quizSetId)
    .eq("user_id", user.id)
    .single();
  if (!quizSet) notFound();

  // One round-trip: questions with their options embedded (PostgREST join).
  const { data: questionRows } = await supabase
    .from("questions")
    .select(
      "id,prompt,difficulty,topic,explanation,correct_answer,source_page_start,source_page_end,source_excerpt,created_at," +
        "answer_options(id,label,content,is_correct)"
    )
    .eq("quiz_set_id", quizSetId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const questions: PlayerQuestion[] = ((questionRows ?? []) as unknown as QuestionRow[]).map(
    (q) => ({
      id: q.id,
      prompt: q.prompt,
      difficulty: q.difficulty,
      topic: q.topic,
      explanation: q.explanation,
      sourcePageStart: q.source_page_start,
      sourcePageEnd: q.source_page_end,
      sourceExcerpt: q.source_excerpt,
      options: [...(q.answer_options ?? [])]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((o) => ({ id: o.id, label: o.label, content: o.content, isCorrect: o.is_correct })),
    })
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
            Source-grounded quiz
          </p>
          <h1 className="font-display text-2xl font-bold text-[var(--fg-strong)]">
            {quizSet.title}
          </h1>
          <p className="text-sm text-[var(--fg-muted)]">
            {questions.length} question{questions.length === 1 ? "" : "s"} · every
            answer cites the page it came from.
          </p>
        </div>
        <Link
          href="/dashboard/documents"
          className="inline-flex flex-shrink-0 items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Documents
        </Link>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-subtle)] px-6 py-12 text-center text-sm text-[var(--fg-muted)]">
          This quiz has no questions yet.
        </div>
      ) : (
        <RagQuizPlayer quizSetId={quizSet.id} questions={questions} />
      )}
    </div>
  );
}
