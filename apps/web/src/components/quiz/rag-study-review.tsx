import { Target, ListChecks, CheckCircle2, Sparkles } from "lucide-react";
import { SourceRef } from "./source-ref";

export type ReviewWeakTopic = {
  topic: string;
  why: string;
  recommendedAction: string;
  sourcePageStart: number | null;
  sourceExcerpt: string | null;
};

export type StudyReviewData = {
  text: string;
  attemptsReviewed: number;
  correct: number;
  incorrect: number;
  weakTopics: ReviewWeakTopic[];
  recommendedActions: string[];
};

/**
 * US-RAG-010b: read-only report for a `mode='study_review'` quiz_set. Renders the
 * generated `study_reviews` row — an overall summary with an attempts/accuracy
 * readout, the cited weak topics (each grounded in a source page+excerpt), and
 * recommended next steps. A student who aced everything sees a positive
 * "no weak topics" state rather than an empty page.
 */
export function RagStudyReview({ review }: { review: StudyReviewData }) {
  const total = review.attemptsReviewed || review.correct + review.incorrect;
  const accuracy = total ? Math.round((review.correct / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <section className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5 sm:p-6">
        {review.text && (
          <p className="text-[15px] leading-relaxed text-[var(--fg)]">{review.text}</p>
        )}
        <div className="mt-4 flex items-center gap-4">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${accuracy}%` }}
            />
          </div>
          <span className="font-mono text-xs text-[var(--fg-muted)]">
            {review.correct}/{total} correct · {accuracy}%
          </span>
        </div>
        <p className="mt-2 font-mono text-xs text-[var(--fg-faint)]">
          {total} attempt{total === 1 ? "" : "s"} reviewed · {review.incorrect} missed
        </p>
      </section>

      {/* Weak topics */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[var(--fg-faint)]">
          <Target className="h-3.5 w-3.5" />
          Weak topics{review.weakTopics.length > 0 && ` · ${review.weakTopics.length}`}
        </h2>

        {review.weakTopics.length === 0 ? (
          <div className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--success-border)] bg-[var(--success-bg)] px-5 py-6 text-sm text-[var(--success)]">
            <Sparkles className="h-5 w-5 flex-shrink-0" />
            <span>No weak topics — you were strong across the board. Keep it up.</span>
          </div>
        ) : (
          <ul className="space-y-4">
            {review.weakTopics.map((t, i) => (
              <li
                key={i}
                className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--fg-strong)]">{t.topic}</h3>
                  {(t.sourcePageStart != null || t.sourceExcerpt) && (
                    <span className="flex-shrink-0">
                      <SourceRef
                        page={t.sourcePageStart ?? undefined}
                        passage={t.sourceExcerpt ?? "Source passage unavailable."}
                      />
                    </span>
                  )}
                </div>
                {t.why && <p className="text-sm text-[var(--fg-muted)]">{t.why}</p>}
                {t.recommendedAction && (
                  <p className="mt-3 border-l-2 border-[var(--accent-border)] pl-3 text-sm text-[var(--fg)]">
                    <span className="font-medium text-[var(--accent)]">Try this: </span>
                    {t.recommendedAction}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recommended actions */}
      {review.recommendedActions.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[var(--fg-faint)]">
            <ListChecks className="h-3.5 w-3.5" />
            Recommended next steps
          </h2>
          <ul className="space-y-2">
            {review.recommendedActions.map((action, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-4 py-3"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--accent)]" />
                <span className="text-sm text-[var(--fg)]">{action}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
