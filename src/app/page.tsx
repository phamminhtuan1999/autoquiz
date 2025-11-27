import Link from "next/link";
import { PdfUploader } from "@/components/pdf/uploader";
import { AuthButton } from "@/components/auth-button";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16 sm:px-8">
        <header className="space-y-4 text-center sm:text-left">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                AutoQuiz
              </p>
              <h1 className="text-4xl font-bold text-slate-900">
                Turn dense documents into editable quizzes in seconds.
              </h1>
            </div>
            <div className="hidden sm:block">
              <AuthButton />
            </div>
          </div>
          <p className="text-lg text-slate-600">
            Upload a PDF, let Google Gemini craft assessment-ready questions,
            and keep everything synced to Supabase with credit-aware billing
            powered by Stripe.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="rounded-full border border-slate-200 px-3 py-1">
              Next.js 14 App Router
            </span>
            <span className="rounded-full border border-slate-200 px-3 py-1">
              Supabase Auth + RLS
            </span>
            <span className="rounded-full border border-slate-200 px-3 py-1">
              Stripe Credits
            </span>
            <span className="rounded-full border border-slate-200 px-3 py-1">
              Google Gemini
            </span>
          </div>
          <div className="block sm:hidden">
            <AuthButton />
          </div>
        </header>
        <PdfUploader />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Need a dashboard?
          </h2>
          <p className="text-sm text-slate-600">
            Manage credits, view quiz history, and resume attempts on the{" "}
            <Link
              href="/dashboard"
              className="font-semibold text-indigo-600 hover:underline"
            >
              dashboard
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
