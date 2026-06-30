import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  RagQuizPlayer,
  type PlayerQuestion,
} from "@/components/quiz/rag-quiz-player";
import {
  RagCramPlayer,
  type CramCard,
} from "@/components/quiz/rag-cram-player";
import {
  RagMockPlayer,
  type MockMcq,
  type MockEssay,
} from "@/components/quiz/rag-mock-player";
import {
  RagStudyReview,
  type StudyReviewData,
} from "@/components/quiz/rag-study-review";

export const dynamic = "force-dynamic";

type QuizSetPageProps = {
  params: Promise<{ quizSetId: string }>;
};

type QuestionRow = {
  id: string;
  type: string;
  prompt: string;
  difficulty: string | null;
  topic: string | null;
  explanation: string | null;
  correct_answer: string | null;
  source_page_start: number | null;
  source_page_end: number | null;
  source_excerpt: string | null;
  metadata: {
    max_points?: number | null;
    suggested_minutes?: number | null;
    rubric?: unknown;
  } | null;
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
      "id,type,prompt,difficulty,topic,explanation,correct_answer,source_page_start,source_page_end,source_excerpt,metadata,created_at," +
        "answer_options(id,label,content,is_correct)"
    )
    .eq("quiz_set_id", quizSetId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const rows = (questionRows ?? []) as unknown as QuestionRow[];
  const isCram = quizSet.mode === "cram";
  const isMock = quizSet.mode === "mock";
  const isReview = quizSet.mode === "study_review";

  // A study review is a report, not a set of questions; fetch its row instead.
  type ReviewRow = {
    summary: { text?: string; attempts_reviewed?: number; correct?: number; incorrect?: number } | null;
    weak_topics:
      | {
          topic?: string;
          why?: string;
          recommended_action?: string;
          source?: { page_start?: number | null; excerpt?: string | null } | null;
        }[]
      | null;
    recommended_actions: string[] | null;
  };
  let review: StudyReviewData | null = null;
  if (isReview) {
    const { data: reviewRow } = await supabase
      .from("study_reviews")
      .select("summary,weak_topics,recommended_actions")
      .eq("quiz_set_id", quizSetId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = reviewRow as ReviewRow | null;
    if (r) {
      review = {
        text: r.summary?.text ?? "",
        attemptsReviewed: r.summary?.attempts_reviewed ?? 0,
        correct: r.summary?.correct ?? 0,
        incorrect: r.summary?.incorrect ?? 0,
        weakTopics: (r.weak_topics ?? []).map((w) => ({
          topic: w.topic ?? "",
          why: w.why ?? "",
          recommendedAction: w.recommended_action ?? "",
          sourcePageStart: w.source?.page_start ?? null,
          sourceExcerpt: w.source?.excerpt ?? null,
        })),
        recommendedActions: r.recommended_actions ?? [],
      };
    }
  }

  const cards: CramCard[] = rows.map((q) => ({
    id: q.id,
    front: q.prompt,
    back: q.correct_answer ?? "",
    difficulty: q.difficulty,
    topic: q.topic,
    sourcePageStart: q.source_page_start,
    sourcePageEnd: q.source_page_end,
    sourceExcerpt: q.source_excerpt,
  }));

  const questions: PlayerQuestion[] = rows.map((q) => ({
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
  }));

  // Mock sets carry two question kinds; split them and derive a time limit from
  // the questions' suggested minutes (the same formula as the backend default).
  const sortOptions = (q: QuestionRow): MockMcq["options"] =>
    [...(q.answer_options ?? [])]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((o) => ({ id: o.id, label: o.label, content: o.content, isCorrect: o.is_correct }));

  const mockMcqs: MockMcq[] = rows
    .filter((q) => q.type === "mcq")
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      difficulty: q.difficulty,
      topic: q.topic,
      sourcePageStart: q.source_page_start,
      sourceExcerpt: q.source_excerpt,
      options: sortOptions(q),
    }));

  const mockEssays: MockEssay[] = rows
    .filter((q) => q.type === "essay")
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      maxPoints: q.metadata?.max_points ?? null,
      suggestedMinutes: q.metadata?.suggested_minutes ?? null,
      difficulty: q.difficulty,
      topic: q.topic,
      sourcePageStart: q.source_page_start,
      sourceExcerpt: q.source_excerpt,
    }));

  const timeLimitMinutes = Math.max(
    1,
    Math.round(
      mockMcqs.length * 1.5 +
        mockEssays.reduce((sum, e) => sum + (e.suggestedMinutes ?? 12), 0)
    )
  );

  const count = rows.length;
  const reviewedCount = review?.attemptsReviewed ?? 0;
  const eyebrow = isReview
    ? "Source-grounded study review"
    : isMock
      ? "Source-grounded mock exam"
      : isCram
        ? "Source-grounded cram"
        : "Source-grounded quiz";
  const noun = isCram ? "card" : "question";
  const metaLine = isReview
    ? `${reviewedCount} attempt${reviewedCount === 1 ? "" : "s"} reviewed`
    : `${count} ${noun}${count === 1 ? "" : "s"}`;
  const subtitle = isReview
    ? "your weak topics, grounded in the source."
    : isMock
      ? `timed ${timeLimitMinutes} min · MCQ auto-graded, essays graded against a cited rubric.`
      : isCram
        ? "flip to study — every card cites the page it came from."
        : "every answer cites the page it came from.";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
            {eyebrow}
          </p>
          <h1 className="font-display text-2xl font-bold text-[var(--fg-strong)]">
            {quizSet.title}
          </h1>
          <p className="text-sm text-[var(--fg-muted)]">
            {metaLine} · {subtitle}
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

      {isReview ? (
        review ? (
          <RagStudyReview review={review} />
        ) : (
          <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-subtle)] px-6 py-12 text-center text-sm text-[var(--fg-muted)]">
            This review isn’t ready yet.
          </div>
        )
      ) : count === 0 ? (
        <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-subtle)] px-6 py-12 text-center text-sm text-[var(--fg-muted)]">
          This {isCram ? "deck" : isMock ? "exam" : "quiz"} has no {noun}s yet.
        </div>
      ) : isMock ? (
        <RagMockPlayer
          quizSetId={quizSet.id}
          mcqs={mockMcqs}
          essays={mockEssays}
          timeLimitMinutes={timeLimitMinutes}
        />
      ) : isCram ? (
        <RagCramPlayer quizSetId={quizSet.id} cards={cards} />
      ) : (
        <RagQuizPlayer quizSetId={quizSet.id} questions={questions} />
      )}
    </div>
  );
}
