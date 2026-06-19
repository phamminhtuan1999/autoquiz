import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BuyCreditsButton } from "@/components/buy-credits-button";

export const dynamic = "force-dynamic";

type MockExamListItem = {
  id: string;
  title: string;
  source_filenames: string[];
  created_at: string;
  status: string;
  total_score?: number;
  mcq_score?: number;
  time_spent_seconds?: number;
};

function examStatusChip(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    graded:      { label: "Completed",   bg: "var(--success-bg)",  color: "var(--success)" },
    submitted:   { label: "Grading…",    bg: "var(--info-bg)",     color: "var(--info)"    },
    in_progress: { label: "In progress", bg: "var(--amber-bg)",    color: "var(--amber)"   },
    draft:       { label: "Draft",       bg: "var(--bg-muted)",    color: "var(--fg-muted)"},
  };
  const s = map[status] ?? map.draft;
  return (
    <span
      className="rounded-full border px-2 py-0.5 font-mono text-xs font-medium"
      style={{ background: s.bg, color: s.color, borderColor: s.color + "44" }}
    >
      {s.label}
    </span>
  );
}

export default async function MockExamHubPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: profile }, { data: mockExams }] = await Promise.all([
    supabase.from("profiles").select("credits").eq("id", user.id).single(),
    supabase.from("mock_exams").select("id,title,source_filenames,created_at,status,total_score,mcq_score,time_spent_seconds").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  const exams = (mockExams ?? []) as MockExamListItem[];
  const credits = profile?.credits ?? 0;
  const canCreate = credits >= 5;

  const graded = exams.filter((e) => e.status === "graded");
  const avgScore = graded.length
    ? Math.round(graded.reduce((s, e) => s + (e.total_score ?? 0), 0) / graded.length)
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg-strong)]">Mock exams</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">60-minute timed exams from your documents.</p>
        </div>
        <Link
          href="/dashboard/mock-exam/new"
          className={`inline-flex items-center rounded-[var(--r-md)] px-4 py-2 text-sm font-semibold transition-colors ${
            canCreate
              ? "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
              : "bg-[var(--bg-muted)] text-[var(--fg-faint)] cursor-not-allowed"
          }`}
        >
          + New exam
        </Link>
      </div>

      {/* Credits + stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Credits", value: credits, note: canCreate ? "Ready" : "Need 5+" },
          { label: "Completed", value: graded.length },
          { label: "Avg score", value: avgScore != null ? `${avgScore}%` : "—" },
          { label: "Docs used", value: new Set(exams.flatMap((e) => e.source_filenames)).size },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">{s.label}</p>
            <p className="mt-1 font-mono text-xl font-semibold text-[var(--fg-strong)]">{s.value}</p>
            {s.note && <p className="mt-0.5 text-xs text-[var(--fg-faint)]">{s.note}</p>}
          </div>
        ))}
      </div>

      {!canCreate && (
        <div className="flex items-center justify-between rounded-[var(--r-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3">
          <p className="text-sm text-[var(--warning)]">You need at least 5 credits to create a mock exam.</p>
          <BuyCreditsButton />
        </div>
      )}

      {/* Exam list */}
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)]">
        {exams.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-[var(--fg-muted)]">No exams yet.</p>
            <Link href="/dashboard/mock-exam/new" className="mt-2 inline-block text-sm text-[var(--accent)] hover:underline">
              Create your first exam
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Title</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Score</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Date</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {exams.map((exam) => (
                <tr key={exam.id} className="transition-colors hover:bg-[var(--bg-subtle)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--fg)]">{exam.title}</p>
                    <p className="text-xs text-[var(--fg-faint)]">{exam.source_filenames.length} doc{exam.source_filenames.length !== 1 ? "s" : ""}</p>
                  </td>
                  <td className="px-4 py-3">{examStatusChip(exam.status)}</td>
                  <td className="px-4 py-3 font-mono text-sm text-[var(--fg-muted)]">
                    {exam.total_score != null ? `${exam.total_score}%` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--fg-faint)]">
                    {new Date(exam.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {exam.status === "graded" && (
                      <Link href={`/dashboard/mock-exam/${exam.id}/results`} className="text-xs text-[var(--accent)] hover:underline">
                        Results
                      </Link>
                    )}
                    {(exam.status === "draft" || exam.status === "in_progress") && (
                      <Link href={`/dashboard/mock-exam/${exam.id}`} className="text-xs text-[var(--accent)] hover:underline">
                        {exam.status === "draft" ? "Start" : "Continue"}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
