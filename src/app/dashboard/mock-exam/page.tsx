import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export default async function MockExamHubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch user's profile for credits
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  // Fetch mock exams
  const { data: mockExams } = await supabase
    .from("mock_exams")
    .select(`
      id,
      title,
      source_filenames,
      created_at,
      status,
      total_score,
      mcq_score,
      time_spent_seconds
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const mockExamsList = (mockExams || []) as MockExamListItem[];

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Mock Exam Center
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Comprehensive 60-minute exams that simulate real finals
        </p>
      </div>

      {/* Credits Overview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Available Credits
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {profile?.credits ?? 0}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Mock Exam Cost
            </p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              5 credits
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              30 MCQs + 2 Essays
            </p>
          </div>
        </div>
        {(profile?.credits ?? 0) < 5 && (
          <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            ⚠️ You need at least 5 credits to create a mock exam. Get more credits to continue.
          </div>
        )}
      </section>

      {/* Create New Mock Exam */}
      <section className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center dark:bg-slate-800 dark:border-slate-600">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-100 text-3xl shadow-sm">
          📚
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Create New Mock Exam
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Combine 1-5 PDF lectures into a comprehensive timed exam
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-xl">📄</span>
              <span>1-5 PDF Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <span>60 Minute Timer</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">✍️</span>
              <span>AI-Graded Essays</span>
            </div>
          </div>
          <Link
            href="/dashboard/mock-exam/new"
            className={`
              inline-flex items-center justify-center rounded-lg px-6 py-3 font-medium transition-colors
              ${(profile?.credits ?? 0) >= 5
                ? "bg-indigo-500 text-white hover:bg-indigo-600"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }
            `}
          >
            🎓 Create Mock Exam
          </Link>
        </div>
      </section>

      {/* Recent Mock Exams */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Your Mock Exams
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Complete exam history and results
            </p>
          </div>
        </div>

        {mockExamsList.length > 0 ? (
          <div className="space-y-4">
            {mockExamsList.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:hover:bg-slate-700/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">
                      {exam.title}
                    </h3>
                    {exam.status === "graded" && exam.total_score && (
                      <span className={`
                        text-sm px-2 py-1 rounded-full font-medium
                        ${exam.total_score >= 90 ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300" :
                          exam.total_score >= 80 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" :
                          exam.total_score >= 70 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" :
                          "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"}
                      `}>
                        {exam.total_score}% • {exam.total_score >= 90 ? "A" : exam.total_score >= 80 ? "B" : exam.total_score >= 70 ? "C" : "D"}
                      </span>
                    )}
                    <span className={`
                      text-xs px-2 py-1 rounded-full font-medium
                      ${exam.status === "graded" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300" :
                        exam.status === "submitted" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" :
                        exam.status === "in_progress" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" :
                        "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}
                    `}>
                      {exam.status === "graded" ? "Completed" :
                       exam.status === "submitted" ? "Grading" :
                       exam.status === "in_progress" ? "In Progress" : "Draft"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                    <span>📄 {exam.source_filenames.length} documents</span>
                    {exam.mcq_score && (
                      <span>📝 MCQ: {exam.mcq_score}/30</span>
                    )}
                    {exam.time_spent_seconds && (
                      <span>⏱️ {Math.floor(exam.time_spent_seconds / 60)}m {exam.time_spent_seconds % 60}s</span>
                    )}
                    <span>📅 {new Date(exam.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {exam.status === "draft" && (
                    <Link
                      href={`/dashboard/mock-exam/${exam.id}`}
                      className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Start Exam
                    </Link>
                  )}
                  {exam.status === "in_progress" && (
                    <Link
                      href={`/dashboard/mock-exam/${exam.id}`}
                      className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Continue
                    </Link>
                  )}
                  {exam.status === "graded" && (
                    <>
                      <Link
                        href={`/dashboard/mock-exam/${exam.id}/results`}
                        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        View Results
                      </Link>
                      <Link
                        href={`/dashboard/mock-exam/${exam.id}`}
                        className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-400"
                      >
                        Review
                      </Link>
                    </>
                  )}
                  {exam.status === "submitted" && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Processing...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              📝
            </div>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              No mock exams yet
            </p>
            <Link
              href="/dashboard/mock-exam/new"
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Create your first mock exam
            </Link>
          </div>
        )}
      </section>

      {/* Quick Stats */}
      {mockExamsList.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Your Performance
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg dark:bg-slate-700/50">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mockExamsList.filter(e => e.status === "graded").length}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Completed</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg dark:bg-slate-700/50">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mockExamsList.filter(e => e.total_score && e.total_score >= 80).length}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">B or Better</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg dark:bg-slate-700/50">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mockExamsList.filter(e => e.total_score !== undefined).length > 0
                  ? Math.round(
                      mockExamsList
                        .filter(e => e.total_score !== undefined)
                        .reduce((sum, e) => sum + e.total_score!, 0) /
                      mockExamsList.filter(e => e.total_score !== undefined).length
                    )
                  : 0}%
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Average Score</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg dark:bg-slate-700/50">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {new Set(mockExamsList.flatMap(e => e.source_filenames)).size}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Documents Used</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}