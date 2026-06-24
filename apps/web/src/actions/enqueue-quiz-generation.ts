"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EnqueueQuizInput = {
  documentId: string;
  numQuestions?: number;
  difficulty?: "easy" | "medium" | "hard";
};

export type EnqueueQuizResult =
  | { jobId: string }
  | { error: string };

/**
 * US-RAG-008b: enqueue a source-grounded quiz generation job for a ready
 * document. Inserts an `ai_jobs` row (job_type=generate_regular_quiz) that the
 * AI worker claims and runs (US-RAG-008). Reads/writes go through the user's
 * session client, so RLS scopes everything to the owner; we additionally check
 * the document is `ready` before queueing. No credit deduction here —
 * US-RAG-011 owns credit spend; the job records credit_cost=0.
 */
export async function enqueueQuizGeneration(
  input: EnqueueQuizInput
): Promise<EnqueueQuizResult> {
  if (!input.documentId) return { error: "A document is required." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Not authenticated." };

  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id,status")
    .eq("id", input.documentId)
    .eq("user_id", user.id)
    .single();
  if (docError || !document) return { error: "Document not found." };
  if (document.status !== "ready") {
    return { error: "This document is still processing. Try again once it is ready." };
  }

  const numQuestions = Math.min(Math.max(input.numQuestions ?? 5, 1), 20);

  const { data: job, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      job_type: "generate_regular_quiz",
      input: {
        document_id: input.documentId,
        num_questions: numQuestions,
        difficulty: input.difficulty ?? "medium",
      },
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { error: jobError?.message ?? "Could not queue quiz generation." };
  }
  return { jobId: job.id as string };
}
