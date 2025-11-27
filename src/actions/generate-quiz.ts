"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { callGemini, type QuizQuestion, type Difficulty } from "@/lib/gemini";

type GenerateQuizInput = {
  documentText: string;
  title: string;
  filename?: string;
  questionCount?: number;
  difficulty?: Difficulty;
};

export async function generateQuiz(
  input: GenerateQuizInput
): Promise<QuizQuestion[]> {
  if (!input.documentText?.trim()) {
    throw new Error("Document text is required");
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  if (!profile || profile.credits < 1) {
    throw new Error("Insufficient credits");
  }

  const questions = await callGemini(
    input.documentText,
    input.questionCount || 10,
    input.difficulty || "medium"
  );

  const { error: deductError } = await supabase.rpc("deduct_credit", {
    p_user_id: user.id,
  } as never);
  if (deductError) {
    throw deductError;
  }

  const { error: insertError } = await supabase.from("quizzes").insert({
    user_id: user.id,
    title: input.title || "Untitled Quiz",
    source_filename: input.filename ?? null,
    questions,
  });

  if (insertError) {
    throw insertError;
  }

  revalidatePath("/dashboard/quizzes");
  return questions;
}
