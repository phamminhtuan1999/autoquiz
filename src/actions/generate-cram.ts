"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGeminiModel } from "@/lib/gemini";
import type { CramResult, GenerateCramInput } from "@/types/cram";

/**
 * Premium Cram Mode Generator
 * Cost: 3 credits
 * Returns: Top 10 golden nuggets + 20 blitz questions
 */
export async function generateCram(
  input: GenerateCramInput
): Promise<CramResult> {
  if (!input.documentText?.trim()) {
    throw new Error("Document text is required");
  }

  const supabase = await createSupabaseServerClient();

  // Authenticate user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  // Check credit balance (must have at least 3 credits)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  if (!profile || profile.credits < 3) {
    throw new Error("Insufficient credits. Cram Mode requires 3 credits.");
  }

  // Generate cram content using AI
  const cramResult = await callGeminiForCram(input.documentText);

  // Store the cram session in quizzes table first
  // (We reuse the quizzes table but store the cram data as questions)
  const { error: insertError } = await supabase.from("quizzes").insert({
    user_id: user.id,
    title: input.title || "Cram Session",
    source_filename: input.filename ?? null,
    questions: cramResult as never, // Store the entire CramResult as JSONB
  });

  if (insertError) {
    throw new Error(`Failed to save cram session: ${insertError.message}`);
  }

  // Deduct 3 credits only after successful save
  const { error: deductError } = await supabase.rpc("deduct_credits", {
    p_user_id: user.id,
    p_amount: 3,
  } as never);

  if (deductError) {
    // If credit deduction fails, try to delete the quiz entry to maintain consistency
    await supabase
      .from("quizzes")
      .delete()
      .eq("user_id", user.id)
      .eq("title", input.title || "Cram Session")
      .order("created_at", { ascending: false })
      .limit(1);
    throw new Error(
      `Failed to deduct credits: ${deductError.message}. Cram session was not saved.`
    );
  }

  return cramResult;
}

/**
 * Call Gemini API with Cram Mode specific prompt
 * Single-pass extraction of golden nuggets + blitz questions
 */
async function callGeminiForCram(documentText: string): Promise<CramResult> {
  const model = await getGeminiModel();

  const prompt = `You are an Exam Tutor helping a student who has an exam tomorrow. Analyze the provided document and extract the most critical information for rapid review.

**Your task:**
1. Identify the top 10 highest-yield facts, definitions, formulas, or concepts (the "Golden Nuggets")
2. Generate 20 rapid-fire short-answer questions based strictly on those facts

**Requirements:**
- Return ONLY a valid JSON object with this exact structure:
  {
    "summary": [
      {"topic": "string", "content": "string"},
      ...10 items total
    ],
    "blitz_questions": [
      {"question": "string", "answer": "string"},
      ...20 items total
    ]
  }
- NO markdown, NO code blocks, NO explanations - ONLY the JSON object
- Ignore fluff and filler content - focus on exam-critical information
- Questions should be short and direct (suitable for flashcards)
- Answers should be concise (1-3 sentences max)

**Document:**
${documentText.slice(0, 15_000)}`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();

  // Remove markdown code blocks if present
  if (text.startsWith("```json")) {
    text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } else if (text.startsWith("```")) {
    text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const payload = JSON.parse(text) as CramResult;

    // Validate structure
    if (!payload.summary || !Array.isArray(payload.summary)) {
      throw new Error("Missing or invalid 'summary' field");
    }
    if (!payload.blitz_questions || !Array.isArray(payload.blitz_questions)) {
      throw new Error("Missing or invalid 'blitz_questions' field");
    }

    // Validate we have the right number of items
    if (payload.summary.length !== 10) {
      console.warn(`Expected 10 golden nuggets, got ${payload.summary.length}`);
    }
    if (payload.blitz_questions.length !== 20) {
      console.warn(
        `Expected 20 blitz questions, got ${payload.blitz_questions.length}`
      );
    }

    return payload;
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini response for Cram Mode: ${
        (error as Error).message
      }`
    );
  }
}
