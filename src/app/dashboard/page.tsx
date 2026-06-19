import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BuyCreditsButton } from "@/components/buy-credits-button";
import { handlePaymentSuccess } from "@/actions/handle-payment-success";

export const dynamic = "force-dynamic";

type QuizListItem = {
  id: string;
  title: string;
  created_at: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; session_id?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const params = await searchParams;

  let paymentResult: {
    success?: boolean;
    error?: string;
    creditsAdded?: number;
    alreadyProcessed?: boolean;
  } | null = null;
  if (params.success === "1" && params.session_id) {
    try {
      paymentResult = await handlePaymentSuccess(params.session_id);
    } catch (error) {
      paymentResult = { error: (error as Error).message };
    }
  }

  const [{ data: profile }, { data: quizzes }] = await Promise.all([
    supabase.from("profiles").select("credits").eq("id", user.id).single(),
    supabase
      .from("quizzes")
      .select("id,title,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const credits = profile?.credits ?? 0;
  const quizList = (quizzes ?? []) as QuizListItem[];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-8">

      {/* Payment feedback */}
      {paymentResult?.success && (
        <div className="rounded-[var(--r-sm)] border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          {paymentResult.creditsAdded ?? 10} credits added successfully.
        </div>
      )}
      {paymentResult?.alreadyProcessed && (
        <div className="rounded-[var(--r-sm)] border border-[var(--info-border)] bg-[var(--info-bg)] px-4 py-3 text-sm text-[var(--info)]">
          Payment already processed — credits were added previously.
        </div>
      )}
      {paymentResult?.error && (
        <div className="rounded-[var(--r-sm)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          Error processing payment: {paymentResult.error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-[var(--fg-strong)]">Dashboard</h1>
        <Link
          href="/"
          className="inline-flex items-center rounded-[var(--r-md)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          + Generate quiz
        </Link>
      </div>

      {/* Credits + quick nav */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">Credits</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-[var(--fg-strong)]">{credits}</p>
          <p className="mt-1 text-xs text-[var(--fg-faint)]">1 credit per quiz</p>
          <div className="mt-3">
            <BuyCreditsButton />
          </div>
        </div>

        {[
          { label: "Quizzes", value: quizList.length, href: null },
          { label: "Mock exams", value: null, href: "/dashboard/mock-exam" },
          { label: "Leaderboard", value: null, href: "/dashboard/leaderboard" },
        ].map((card) => (
          <div key={card.label} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">{card.label}</p>
            {card.value != null && (
              <p className="mt-1 font-mono text-3xl font-semibold text-[var(--fg-strong)]">{card.value}</p>
            )}
            {card.href && (
              <Link href={card.href} className="mt-3 inline-block text-xs text-[var(--accent)] hover:underline">
                Open
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Quick links to new screens */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Review studio", description: "Approve, edit, or reject AI-generated questions.", href: "/dashboard/review" },
          { label: "Analytics", description: "Mastery trends, score distribution, accuracy by question.", href: "/dashboard/analytics" },
          { label: "Cram mode", description: "Key concepts and quick-recall flashcards.", href: "/dashboard/cram" },
        ].map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="group rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
          >
            <p className="font-display text-sm font-semibold text-[var(--fg-strong)] transition-colors group-hover:text-[var(--accent)]">
              {link.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">{link.description}</p>
          </Link>
        ))}
      </div>

      {/* Quiz list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[var(--fg-strong)]">Recent quizzes</h2>
        </div>
        <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)]">
          {quizList.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-[var(--fg-muted)]">No quizzes yet.</p>
              <Link href="/" className="mt-2 inline-block text-sm text-[var(--accent)] hover:underline">
                Upload a PDF to get started
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {quizList.map((quiz) => (
                <li key={quiz.id} className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--bg-subtle)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--fg)]">{quiz.title}</p>
                    <p className="font-mono text-xs text-[var(--fg-faint)]">
                      {new Date(quiz.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/quizzes/${quiz.id}`}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </div>
  );
}
