"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function recordAnswer(quizId: string, questionIndex: number, isCorrect: boolean) {
  const supabase = createSupabaseBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("question_attempts")
    .insert({
      user_id: user.id,
      quiz_id: quizId,
      question_index: questionIndex,
      is_correct: isCorrect,
    });

  if (error) {
    console.error("Error recording answer:", error);
    return { error: error.message };
  }

  return { success: true };
}
