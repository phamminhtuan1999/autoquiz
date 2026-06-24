"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { enqueueQuizGeneration } from "@/actions/enqueue-quiz-generation";

const POLL_MS = 4000;

type JobRow = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  progress: number;
  current_step: string | null;
  error_message: string | null;
  output: { quiz_set_id?: string } | null;
};

const JOB_COLUMNS = "id,status,progress,current_step,error_message,output";

/**
 * US-RAG-008b: trigger source-grounded quiz generation for a ready document and
 * poll the `ai_jobs` row to completion (same enqueue+poll pattern as document
 * processing). On success, links to the cited quiz player.
 */
export function GenerateQuizControl({ documentId }: { documentId: string }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobRow | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const terminal = job?.status === "succeeded" || job?.status === "failed";

  useEffect(() => {
    if (!jobId || terminal) return;
    const supabase = createSupabaseBrowserClient();
    const tick = async () => {
      const { data } = await supabase
        .from("ai_jobs")
        .select(JOB_COLUMNS)
        .eq("id", jobId)
        .single();
      if (active.current && data) setJob(data as JobRow);
    };
    const interval = setInterval(tick, POLL_MS);
    void tick();
    return () => clearInterval(interval);
  }, [jobId, terminal]);

  const start = async () => {
    setStarting(true);
    setError(null);
    const result = await enqueueQuizGeneration({ documentId, numQuestions: 5 });
    setStarting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setJobId(result.jobId);
    setJob({ id: result.jobId, status: "queued", progress: 0, current_step: null, error_message: null, output: null });
  };

  // Success → link to the player.
  if (job?.status === "succeeded" && job.output?.quiz_set_id) {
    return (
      <Link
        href={`/dashboard/quiz-sets/${job.output.quiz_set_id}`}
        className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-1.5 text-xs font-medium text-[var(--success)] transition-opacity hover:opacity-80"
      >
        Take quiz
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  // Failure.
  if (job?.status === "failed" || error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[var(--danger)]">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{error ?? job?.error_message ?? "Generation failed."}</span>
        <button
          type="button"
          onClick={start}
          className="font-medium underline hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  // In flight.
  if (jobId) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
        <span>{job?.current_step ?? "Generating quiz…"}</span>
        {typeof job?.progress === "number" && job.progress > 0 && (
          <span className="font-mono text-[var(--fg-faint)]">{job.progress}%</span>
        )}
      </div>
    );
  }

  // Idle.
  return (
    <button
      type="button"
      onClick={start}
      disabled={starting}
      className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-80 disabled:opacity-60"
    >
      {starting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      Generate quiz
    </button>
  );
}
