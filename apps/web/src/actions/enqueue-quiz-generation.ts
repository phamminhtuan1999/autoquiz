"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GenerationMode = "regular" | "cram";

export type EnqueueQuizInput = {
  documentId: string;
  /** Which RAG generation mode to queue. Defaults to a regular MCQ quiz. */
  mode?: GenerationMode;
  numQuestions?: number;
  numCards?: number;
  difficulty?: "easy" | "medium" | "hard";
};

export type EnqueueQuizResult =
  | { jobId: string }
  | { error: string };

/**
 * US-RAG-008b / US-RAG-009b: enqueue a source-grounded generation job for a
 * ready document. Inserts an `ai_jobs` row that the AI worker claims and runs —
 * `generate_regular_quiz` (US-RAG-008) for `mode="regular"` or `generate_cram`
 * (US-RAG-009) for `mode="cram"`. Reads/writes go through the user's session
 * client, so RLS scopes everything to the owner; we additionally check the
 * document is `ready` before queueing. No credit deduction here — US-RAG-011
 * owns credit spend; the job records credit_cost=0.
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

  const mode: GenerationMode = input.mode ?? "regular";
  const difficulty = input.difficulty ?? "medium";
  const { jobType, jobInput } =
    mode === "cram"
      ? {
          jobType: "generate_cram" as const,
          jobInput: {
            document_id: input.documentId,
            num_cards: Math.min(Math.max(input.numCards ?? 10, 1), 30),
            difficulty,
          },
        }
      : {
          jobType: "generate_regular_quiz" as const,
          jobInput: {
            document_id: input.documentId,
            num_questions: Math.min(Math.max(input.numQuestions ?? 5, 1), 20),
            difficulty,
          },
        };

  const { data: job, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({ user_id: user.id, job_type: jobType, input: jobInput })
    .select("id")
    .single();

  if (jobError || !job) {
    return { error: jobError?.message ?? "Could not queue generation." };
  }
  return { jobId: job.id as string };
}
