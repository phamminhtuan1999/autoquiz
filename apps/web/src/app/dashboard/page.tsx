import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BuyCreditsButton } from "@/components/buy-credits-button";
import { handlePaymentSuccess } from "@/actions/handle-payment-success";

export const dynamic = "force-dynamic";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  const credits = profile?.credits ?? 0;

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
          href="/dashboard/documents"
          className="inline-flex items-center rounded-[var(--r-md)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          + Generate quiz
        </Link>
      </div>

      {/* Credits */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">Credits</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-[var(--fg-strong)]">{credits}</p>
          <p className="mt-1 text-xs text-[var(--fg-faint)]">regular 1 · cram 3 · mock 5 · review 1</p>
          <div className="mt-3">
            <BuyCreditsButton />
          </div>
        </div>
      </div>

      {/* Quick links to the RAG screens */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Documents", description: "Upload a PDF and generate a quiz, cram deck, mock exam, or study review.", href: "/dashboard/documents" },
          { label: "Review studio", description: "Approve, edit, or reject AI-generated questions.", href: "/dashboard/review" },
          { label: "Analytics", description: "Mastery trends, score distribution, accuracy by question.", href: "/dashboard/analytics" },
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

    </div>
  );
}
