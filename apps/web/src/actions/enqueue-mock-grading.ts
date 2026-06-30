"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EnqueueMockGradingResult = { jobId: string } | { error: string };

/**
 * US-RAG-012b: enqueue a `grade_mock_exam` job for a submitted mock `quiz_set`.
 * The worker (US-RAG-012b backend) reads the set's essay questions + the
 * student's recorded `answer_text`, grades each against its stored rubric, and
 * writes the per-essay scores + feedback to the job's `output` (decision 0013).
 *
 * Reads/writes go through the user's session client, so RLS scopes everything to
 * the owner; we additionally check the set exists, is owned, and is `mode='mock'`
 * before queueing. US-RAG-011: grading is free (credit_cost=0) — the 5 credits
 * charged when the mock exam was generated cover the whole session.
 */
export async function enqueueMockGrading(input: {
  quizSetId: string;
}): Promise<EnqueueMockGradingResult> {
  if (!input.quizSetId) return { error: "A mock exam is required." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Not authenticated." };

  const { data: quizSet, error: setError } = await supabase
    .from("quiz_sets")
    .select("id,mode")
    .eq("id", input.quizSetId)
    .eq("user_id", user.id)
    .single();
  if (setError || !quizSet) return { error: "Mock exam not found." };
  if (quizSet.mode !== "mock") {
    return { error: "This quiz set is not a mock exam." };
  }

  const { data: job, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      job_type: "grade_mock_exam",
      input: { quiz_set_id: input.quizSetId },
      credit_cost: 0,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { error: jobError?.message ?? "Could not queue grading." };
  }
  return { jobId: job.id as string };
}
