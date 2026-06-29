"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type RecordRagAttemptInput = {
  questionId: string;
  quizSetId: string;
  selectedOptionId: string | null;
  /** MCQ/flashcard correctness; `null` for an essay answer (graded later). */
  isCorrect: boolean | null;
  /** Free-text answer for an essay question (US-RAG-012b); omitted for MCQ. */
  answerText?: string | null;
  timeSpentMs?: number;
};

/**
 * US-RAG-008b: record one answered RAG question into `rag_question_attempts`,
 * the table that runs beside the legacy `question_attempts` during cutover.
 * MCQ/flashcard rows carry `selected_option_id` + `is_correct`; an essay row
 * (US-RAG-012b) carries `answer_text` with a null `is_correct` (graded later by
 * the `grade_mock_exam` job). Best-effort: a failed insert is logged and
 * returned, but never blocks the student from continuing the quiz.
 */
export async function recordRagAttempt(input: RecordRagAttemptInput) {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("rag_question_attempts").insert({
    user_id: user.id,
    question_id: input.questionId,
    quiz_set_id: input.quizSetId,
    selected_option_id: input.selectedOptionId,
    is_correct: input.isCorrect,
    answer_text: input.answerText ?? null,
    time_spent_ms: input.timeSpentMs ?? null,
  });

  if (error) {
    // Best-effort write: a failed attempt-record must never interrupt
    // quiz-taking (e.g. a stale tab pointing at a since-deleted quiz_set fails
    // the foreign-key check). Log a readable warning — not a raw object, which
    // serializes to "{}" and trips the Next.js error overlay.
    const detail = [error.message, error.code, error.details, error.hint]
      .filter(Boolean)
      .join(" · ");
    console.warn(`Could not record RAG attempt: ${detail || "unknown error"}`);
    return { error: error.message ?? "Could not record attempt" };
  }
  return { success: true };
}
