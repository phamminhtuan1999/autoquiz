import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AnalyticsDashboard } from "@/components/teacher/analytics-dashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[var(--fg-strong)]">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Mastery trends, score distribution, and question accuracy.</p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
