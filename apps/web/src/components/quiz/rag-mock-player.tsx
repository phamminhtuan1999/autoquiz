"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import {
  Clock,
  Check,
  X,
  RotateCcw,
  Loader2,
  AlertCircle,
  PencilLine,
} from "lucide-react";
import { SourceRef } from "./source-ref";
import { DifficultyChip, type Difficulty } from "./difficulty-chip";
import { recordRagAttempt } from "@/actions/record-rag-attempt";
import { enqueueMockGrading } from "@/actions/enqueue-mock-grading";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type MockOption = {
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
};

export type MockMcq = {
  id: string;
  prompt: string;
  difficulty: string | null;
  topic: string | null;
  sourcePageStart: number | null;
  sourceExcerpt: string | null;
  options: MockOption[];
};

export type MockEssay = {
  id: string;
  prompt: string;
  maxPoints: number | null;
  suggestedMinutes: number | null;
  difficulty: string | null;
  topic: string | null;
  sourcePageStart: number | null;
  sourceExcerpt: string | null;
};

type CriterionGrade = {
  name: string;
  score: number;
  max_points: number;
  comment: string;
};

type EssayGrade = {
  question_id: string;
  prompt: string;
  answered: boolean;
  score: number;
  max_points: number;
  feedback: string;
  criteria: CriterionGrade[];
};

type GradeOutput = {
  result?: string;
  total_score?: number;
  max_total?: number;
  essays?: EssayGrade[];
};

type GradeJobRow = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  current_step: string | null;
  error_message: string | null;
  output: GradeOutput | null;
};

const DIFFICULTY_LABEL: Record<string, Difficulty> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const POLL_MS = 4000;

type Phase = "taking" | "submitting" | "grading" | "done";

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * US-RAG-012b: timed mock-exam session for a `mode='mock'` quiz_set. Exam-style
 * MCQ (select, change until submit, no instant reveal) + essay textareas, each
 * citing its source. A countdown derived from the questions' suggested minutes
 * runs down to an auto-submit. On submit, MCQ answers auto-grade from their
 * options and record `rag_question_attempts`; essay answers record `answer_text`,
 * then a `grade_mock_exam` job grades them against their rubrics — the player
 * polls it and renders the MCQ score plus rubric-scored essay feedback.
 */
export function RagMockPlayer({
  quizSetId,
  mcqs,
  essays,
  timeLimitMinutes,
}: {
  quizSetId: string;
  mcqs: MockMcq[];
  essays: MockEssay[];
  timeLimitMinutes: number;
}) {
  const [phase, setPhase] = useState<Phase>("taking");
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(Math.max(60, timeLimitMinutes * 60));
  const [gradeJobId, setGradeJobId] = useState<string | null>(null);
  const [grade, setGrade] = useState<GradeOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitGuard = useRef(false);

  const totalQuestions = mcqs.length + essays.length;
  const answeredCount =
    Object.keys(mcqAnswers).length +
    essays.filter((e) => (essayAnswers[e.id] ?? "").trim()).length;

  const mcqCorrect = useMemo(
    () =>
      mcqs.reduce((n, q) => {
        const opt = q.options.find((o) => o.id === mcqAnswers[q.id]);
        return n + (opt?.isCorrect ? 1 : 0);
      }, 0),
    [mcqs, mcqAnswers]
  );

  const submit = useCallback(async () => {
    if (submitGuard.current) return;
    submitGuard.current = true;
    setPhase("submitting");
    setError(null);

    // Record MCQ attempts (auto-graded) + essay answers. Await both: the grading
    // job reads the recorded essay `answer_text`, so the writes must land first.
    const writes: Promise<unknown>[] = [];
    for (const q of mcqs) {
      const chosen = mcqAnswers[q.id];
      if (!chosen) continue;
      const opt = q.options.find((o) => o.id === chosen);
      writes.push(
        recordRagAttempt({
          questionId: q.id,
          quizSetId,
          selectedOptionId: chosen,
          isCorrect: Boolean(opt?.isCorrect),
        })
      );
    }
    for (const e of essays) {
      const text = (essayAnswers[e.id] ?? "").trim();
      if (!text) continue;
      writes.push(
        recordRagAttempt({
          questionId: e.id,
          quizSetId,
          selectedOptionId: null,
          isCorrect: null,
          answerText: text,
        })
      );
    }
    await Promise.allSettled(writes);

    if (essays.length === 0) {
      setPhase("done");
      return;
    }

    const result = await enqueueMockGrading({ quizSetId });
    if ("error" in result) {
      setError(result.error);
      setPhase("done");
      return;
    }
    setGradeJobId(result.jobId);
    setPhase("grading");
  }, [mcqs, essays, mcqAnswers, essayAnswers, quizSetId]);

  // Countdown — auto-submits at zero.
  useEffect(() => {
    if (phase !== "taking") return;
    if (secondsLeft <= 0) {
      void submit();
      return;
    }
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase, secondsLeft, submit]);

  // Poll the grading job to completion.
  useEffect(() => {
    if (phase !== "grading" || !gradeJobId) return;
    const supabase = createSupabaseBrowserClient();
    let active = true;
    const tick = async () => {
      const { data } = await supabase
        .from("ai_jobs")
        .select("id,status,current_step,error_message,output")
        .eq("id", gradeJobId)
        .single();
      if (!active || !data) return;
      const job = data as GradeJobRow;
      if (job.status === "succeeded") {
        setGrade(job.output ?? null);
        setPhase("done");
      } else if (job.status === "failed" || job.status === "cancelled") {
        setError(job.error_message ?? "Grading failed.");
        setPhase("done");
      }
    };
    const interval = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [phase, gradeJobId]);

  const reset = () => {
    submitGuard.current = false;
    setPhase("taking");
    setMcqAnswers({});
    setEssayAnswers({});
    setSecondsLeft(Math.max(60, timeLimitMinutes * 60));
    setGradeJobId(null);
    setGrade(null);
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const timeLow = secondsLeft <= 60;

  if (phase === "done") {
    return (
      <MockResults
        mcqs={mcqs}
        mcqAnswers={mcqAnswers}
        mcqCorrect={mcqCorrect}
        essays={essays}
        grade={grade}
        error={error}
        onRetake={reset}
      />
    );
  }

  const grading = phase === "grading" || phase === "submitting";

  return (
    <div className="space-y-6">
      {/* Sticky timer + progress + submit */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <span
          className={[
            "inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums",
            timeLow ? "text-[var(--danger)]" : "text-[var(--fg-strong)]",
          ].join(" ")}
        >
          <Clock className="h-4 w-4" />
          {formatClock(secondsLeft)}
        </span>
        <span className="font-mono text-xs text-[var(--fg-muted)]">
          {answeredCount}/{totalQuestions} answered
        </span>
        <div className="ml-auto">
          <Button
            variant="primary"
            isDisabled={grading}
            onPress={() => void submit()}
          >
            {grading ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit exam"
            )}
          </Button>
        </div>
      </div>

      {mcqs.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--fg-faint)]">
            Multiple choice · {mcqs.length}
          </h2>
          <ol className="space-y-5">
            {mcqs.map((q, i) => {
              const chosenId = mcqAnswers[q.id];
              const diff = q.difficulty ? DIFFICULTY_LABEL[q.difficulty] : undefined;
              return (
                <li
                  key={q.id}
                  className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5 sm:p-6"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--fg-faint)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {diff && <DifficultyChip difficulty={diff} />}
                    {q.topic && (
                      <span className="font-mono text-xs text-[var(--fg-faint)]">{q.topic}</span>
                    )}
                    {(q.sourcePageStart != null || q.sourceExcerpt) && (
                      <span className="ml-auto">
                        <SourceRef
                          page={q.sourcePageStart ?? undefined}
                          passage={q.sourceExcerpt ?? "Source passage unavailable."}
                        />
                      </span>
                    )}
                  </div>

                  <p className="mb-4 text-[17px] font-medium leading-snug text-[var(--fg-strong)]">
                    {q.prompt}
                  </p>

                  <ul className="space-y-2">
                    {q.options.map((opt) => {
                      const isChosen = chosenId === opt.id;
                      return (
                        <li key={opt.id}>
                          <button
                            type="button"
                            disabled={grading}
                            onClick={() =>
                              setMcqAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                            }
                            className={[
                              "flex w-full items-center gap-3 rounded-[var(--r-sm)] border px-3 py-2.5 text-left text-sm transition-colors",
                              isChosen
                                ? "border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                                : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-muted)]",
                              grading ? "cursor-default" : "cursor-pointer",
                            ].join(" ")}
                          >
                            <span className="font-mono text-xs font-semibold opacity-70">
                              {opt.label}
                            </span>
                            <span className="flex-1">{opt.content}</span>
                            {isChosen && (
                              <Check className="h-4 w-4 flex-shrink-0 text-[var(--accent)]" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {essays.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--fg-faint)]">
            Essays · {essays.length}
          </h2>
          <ol className="space-y-5">
            {essays.map((e, i) => {
              const diff = e.difficulty ? DIFFICULTY_LABEL[e.difficulty] : undefined;
              const value = essayAnswers[e.id] ?? "";
              return (
                <li
                  key={e.id}
                  className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5 sm:p-6"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--fg-faint)]">
                      E{i + 1}
                    </span>
                    {diff && <DifficultyChip difficulty={diff} />}
                    {e.maxPoints != null && (
                      <span className="font-mono text-xs text-[var(--fg-faint)]">
                        {e.maxPoints} pts
                      </span>
                    )}
                    {e.suggestedMinutes != null && (
                      <span className="font-mono text-xs text-[var(--fg-faint)]">
                        ~{e.suggestedMinutes} min
                      </span>
                    )}
                    {(e.sourcePageStart != null || e.sourceExcerpt) && (
                      <span className="ml-auto">
                        <SourceRef
                          page={e.sourcePageStart ?? undefined}
                          passage={e.sourceExcerpt ?? "Source passage unavailable."}
                        />
                      </span>
                    )}
                  </div>

                  <p className="mb-4 text-[17px] font-medium leading-snug text-[var(--fg-strong)]">
                    {e.prompt}
                  </p>

                  <textarea
                    value={value}
                    disabled={grading}
                    onChange={(ev) =>
                      setEssayAnswers((prev) => ({ ...prev, [e.id]: ev.target.value }))
                    }
                    rows={6}
                    placeholder="Write your answer…"
                    className="w-full resize-y rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm leading-relaxed text-[var(--fg)] outline-none transition-colors placeholder:text-[var(--fg-faint)] focus:border-[var(--accent-border)] focus:bg-[var(--bg)] disabled:opacity-60"
                  />
                  <p className="mt-1.5 font-mono text-xs text-[var(--fg-faint)]">
                    {value.trim() ? value.trim().split(/\s+/).length : 0} words
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {grading && (
        <div className="flex items-center justify-center gap-2 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-subtle)] px-6 py-5 text-sm text-[var(--fg-muted)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
          {essays.length > 0
            ? "Submitting answers and grading your essays…"
            : "Submitting your answers…"}
        </div>
      )}
    </div>
  );
}

function MockResults({
  mcqs,
  mcqAnswers,
  mcqCorrect,
  essays,
  grade,
  error,
  onRetake,
}: {
  mcqs: MockMcq[];
  mcqAnswers: Record<string, string>;
  mcqCorrect: number;
  essays: MockEssay[];
  grade: GradeOutput | null;
  error: string | null;
  onRetake: () => void;
}) {
  const mcqPct = mcqs.length ? Math.round((mcqCorrect / mcqs.length) * 100) : 0;
  const gradesByQuestion = useMemo(() => {
    const map: Record<string, EssayGrade> = {};
    for (const g of grade?.essays ?? []) map[g.question_id] = g;
    return map;
  }, [grade]);

  return (
    <div className="space-y-6">
      {/* Score banner */}
      <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-6 text-center">
        <p className="font-display text-xl font-semibold text-[var(--fg-strong)]">
          Exam submitted
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-sm text-[var(--fg-muted)]">
          {mcqs.length > 0 && (
            <span>
              MCQ: <span className="text-[var(--fg-strong)]">{mcqCorrect}/{mcqs.length}</span> — {mcqPct}%
            </span>
          )}
          {grade && (grade.max_total ?? 0) > 0 && (
            <span>
              Essays:{" "}
              <span className="text-[var(--fg-strong)]">
                {grade.total_score ?? 0}/{grade.max_total ?? 0}
              </span>{" "}
              pts
            </span>
          )}
        </div>
        <div className="mt-5 flex justify-center">
          <Button variant="outline" onPress={onRetake}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Retake exam
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Essay grading could not finish: {error}</span>
        </div>
      )}

      {/* Essay grades */}
      {essays.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--fg-faint)]">
            Essay grading
          </h2>
          {essays.map((e, i) => {
            const g = gradesByQuestion[e.id];
            return (
              <div
                key={e.id}
                className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5 sm:p-6"
              >
                <div className="mb-2 flex items-center gap-2">
                  <PencilLine className="h-4 w-4 text-[var(--accent)]" />
                  <span className="font-mono text-xs font-semibold text-[var(--fg-faint)]">
                    E{i + 1}
                  </span>
                  {g && (
                    <span className="ml-auto font-mono text-sm font-semibold text-[var(--fg-strong)]">
                      {g.score}/{g.max_points} pts
                    </span>
                  )}
                </div>
                <p className="mb-3 text-[15px] font-medium leading-snug text-[var(--fg-strong)]">
                  {e.prompt}
                </p>

                {!g ? (
                  <p className="font-mono text-xs text-[var(--fg-faint)]">Not graded.</p>
                ) : !g.answered ? (
                  <p className="text-sm italic text-[var(--fg-muted)]">No answer submitted.</p>
                ) : (
                  <div className="space-y-3">
                    {g.criteria.length > 0 && (
                      <ul className="space-y-2">
                        {g.criteria.map((c, ci) => (
                          <li
                            key={ci}
                            className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-[var(--fg-strong)]">
                                {c.name}
                              </span>
                              <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                                {c.score}/{c.max_points}
                              </span>
                            </div>
                            {c.comment && (
                              <p className="mt-1 text-sm text-[var(--fg-muted)]">{c.comment}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {g.feedback && (
                      <p className="border-l-2 border-[var(--accent-border)] pl-3 text-sm italic text-[var(--fg-muted)]">
                        {g.feedback}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* MCQ review */}
      {mcqs.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--fg-faint)]">
            Answer review
          </h2>
          <ol className="space-y-3">
            {mcqs.map((q, i) => {
              const chosen = q.options.find((o) => o.id === mcqAnswers[q.id]);
              const correct = q.options.find((o) => o.isCorrect);
              const isRight = Boolean(chosen?.isCorrect);
              return (
                <li
                  key={q.id}
                  className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] p-4"
                >
                  <div className="flex items-start gap-2.5">
                    {isRight ? (
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--success)]" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--danger)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--fg-strong)]">
                        <span className="font-mono text-xs text-[var(--fg-faint)]">
                          {String(i + 1).padStart(2, "0")}
                        </span>{" "}
                        {q.prompt}
                      </p>
                      <p className="mt-1 text-xs text-[var(--fg-muted)]">
                        Your answer:{" "}
                        <span className={isRight ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                          {chosen ? chosen.content : "— not answered —"}
                        </span>
                        {!isRight && correct && (
                          <>
                            {" · "}Correct:{" "}
                            <span className="text-[var(--success)]">{correct.content}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
