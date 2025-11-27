import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BuyCreditsButton } from "@/components/buy-credits-button";

type QuizListItem = {
  id: string;
  title: string;
  created_at: string;
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [{ data: profile }, { data: quizzes }] = await Promise.all([
    supabase.from("profiles").select("credits").eq("id", user.id).single(),
    supabase
      .from("quizzes")
      .select("id,title,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Credits</p>
        <p className="text-4xl font-bold text-slate-900">
          {profile?.credits ?? 0}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Each quiz generation consumes one credit.
        </p>
        <div className="mt-4">
          <BuyCreditsButton />
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Recent quizzes
            </h2>
            <p className="text-sm text-slate-500">
              Full history stored safely in Supabase.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Generate new
          </Link>
        </div>
        <ul className="mt-6 space-y-4">
          {(quizzes as QuizListItem[] | null)?.length ? (
            (quizzes as QuizListItem[]).map((quiz) => (
              <li
                key={quiz.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 p-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{quiz.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(quiz.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <Link
                  href={`/dashboard/quizzes/${quiz.id}`}
                  className="text-sm font-semibold text-indigo-600 hover:underline"
                >
                  View
                </Link>
              </li>
            ))
          ) : (
            <li className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No quizzes yet. Upload a PDF to get started.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
