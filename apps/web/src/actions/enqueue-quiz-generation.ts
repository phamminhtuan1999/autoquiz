"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GenerationMode = "regular" | "cram" | "mock" | "study_review";

export type EnqueueQuizInput = {
  documentId: string;
  /** Which RAG generation mode to queue. Defaults to a regular MCQ quiz. */
  mode?: GenerationMode;
  numQuestions?: number;
  numCards?: number;
  numMcq?: number;
  numEssay?: number;
  difficulty?: "easy" | "medium" | "hard";
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

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
  const dispatch: Record<GenerationMode, { jobType: string; jobInput: Record<string, unknown> }> = {
    regular: {
      jobType: "generate_regular_quiz",
      jobInput: {
        document_id: input.documentId,
        num_questions: clamp(input.numQuestions ?? 5, 1, 20),
        difficulty,
      },
    },
    cram: {
      jobType: "generate_cram",
      jobInput: {
        document_id: input.documentId,
        num_cards: clamp(input.numCards ?? 10, 1, 30),
        difficulty,
      },
    },
    mock: {
      jobType: "generate_mock_exam",
      jobInput: {
        document_id: input.documentId,
        num_mcq: clamp(input.numMcq ?? 10, 1, 30),
        num_essay: clamp(input.numEssay ?? 2, 0, 5),
        difficulty,
      },
    },
    study_review: {
      jobType: "generate_study_review",
      jobInput: { document_id: input.documentId },
    },
  };
  const { jobType, jobInput } = dispatch[mode];

  // A study review reasons over prior practice. Gate it on existing attempts so
  // the backend never gets a job it would fail with "no attempts to review".
  if (mode === "study_review") {
    const { count } = await supabase
      .from("rag_question_attempts")
      .select("id, questions!inner(document_id)", { count: "exact", head: true })
      .eq("questions.document_id", input.documentId);
    if (!count) {
      return {
        error: "Take a quiz on this document first — a study review needs your attempts.",
      };
    }
  }

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
