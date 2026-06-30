"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

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

/** US-RAG-011: credits reserved per generation mode (legacy economics preserved). */
const CREDIT_COST: Record<GenerationMode, number> = {
  regular: 1,
  cram: 3,
  mock: 5,
  study_review: 1,
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
 * document is `ready` before queueing. US-RAG-011: the per-mode credit cost is
 * reserved atomically via `spend_credits` BEFORE the job is queued (the worker
 * runs async, so the charge cannot wait for completion); the reserved amount is
 * refunded if the job row fails to insert, and recorded on the job's
 * `credit_cost`. Costs preserve the legacy economics (regular 1, cram 3, mock 5)
 * plus a modest study-review cost (1).
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

  // US-RAG-011: reserve the per-mode credit cost atomically before queueing.
  // The worker runs the job asynchronously, so the charge is taken at enqueue
  // time (otherwise a user could queue unlimited work on a low balance).
  // `spend_credits` gates on balance and raises "Insufficient credits" if short.
  // Credit mutation is privileged (service_role only) — we call it through the
  // admin client, passing the id of the already-authenticated user above; the
  // user session can never invoke these RPCs directly.
  const cost = CREDIT_COST[mode];
  const admin = cost > 0 ? createServiceRoleClient() : null;
  if (admin) {
    const { error: spendError } = await admin.rpc("spend_credits", {
      p_user_id: user.id,
      p_amount: cost,
      p_reason: jobType,
    } as never);
    if (spendError) {
      return {
        error: `This generation costs ${cost} credit${cost === 1 ? "" : "s"} and you don't have enough. Top up to continue.`,
      };
    }
  }

  const { data: job, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({ user_id: user.id, job_type: jobType, input: jobInput, credit_cost: cost })
    .select("id")
    .single();

  if (jobError || !job) {
    // The job never queued — give the reserved credits back.
    if (admin) {
      await admin.rpc("refund_credits", { p_user_id: user.id, p_amount: cost } as never);
    }
    return { error: jobError?.message ?? "Could not queue generation." };
  }
  return { jobId: job.id as string };
}
