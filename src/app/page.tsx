import Link from "next/link";
import { PdfUploader } from "@/components/pdf/uploader";
import { Hero3DCanvas } from "@/components/landing/hero-3d-canvas";
import { AuthButton } from "@/components/auth-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Public header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]">
        <nav className="mx-auto flex h-[46px] max-w-5xl items-center justify-between px-4 sm:px-8">
          <Link
            href="/"
            className="font-display text-base font-bold text-[var(--fg-strong)] transition-colors hover:text-[var(--accent)]"
          >
            AutoQuiz
          </Link>
          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard"
              className="hidden text-sm text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)] sm:block"
            >
              Dashboard
            </Link>
            <span className="hidden h-5 w-px bg-[var(--border)] sm:block" aria-hidden="true" />
            <AuthButton />
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
        {/* Hero */}
        <section className="grid gap-12 lg:grid-cols-12 lg:items-center lg:py-8">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <span className="inline-flex w-fit rounded-full border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-3 py-1 font-mono text-xs text-[var(--accent)]">
              Source-grounded · Review-first
            </span>

            <h1 className="font-display text-4xl font-bold leading-tight text-[var(--fg-strong)] sm:text-5xl lg:text-6xl" style={{ textWrap: "balance" }}>
              Upload a document.
              <br />
              AI drafts the quiz.
              <br />
              <span className="text-[var(--accent)]">You approve it.</span>
            </h1>

            <p className="max-w-lg text-base leading-relaxed text-[var(--fg-muted)]">
              Every question cites the exact passage it came from. Confidence is shown
              honestly. Nothing reaches students until you review it.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-[var(--r-md)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                Get started — it&apos;s free
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] px-5 py-2.5 text-sm font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--bg-subtle)]"
              >
                View demo
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 flex items-center justify-center">
            <Hero3DCanvas />
          </div>
        </section>

        {/* Try it */}
        <section className="mt-20">
          <div className="rounded-[var(--r-xl)] border border-[var(--border)] bg-[var(--bg-subtle)] p-8">
            <div className="mb-6 space-y-1">
              <h2 className="font-display text-lg font-semibold text-[var(--fg-strong)]">Try it now</h2>
              <p className="text-sm text-[var(--fg-muted)]">
                Drop a PDF. Questions drafted in under 30 seconds. Review before publishing.
              </p>
            </div>
            <PdfUploader />
          </div>
        </section>

        {/* Value props */}
        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            {
              heading: "Grounded in the source",
              body: "Every question cites the passage it came from. Students see the source; so do you.",
            },
            {
              heading: "AI drafts, you approve",
              body: "Nothing publishes until you review it. Confidence scores flag questions that need a closer look.",
            },
            {
              heading: "Calm, not loud",
              body: "No confetti, no mascots. Real progress shown clearly — score trends, mastery over time.",
            },
          ].map((card) => (
            <div key={card.heading} className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-6">
              <h3 className="font-display text-sm font-semibold text-[var(--fg-strong)]">{card.heading}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">{card.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mt-24 border-t border-[var(--border)] py-10">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <p className="font-display text-sm font-semibold text-[var(--fg-faint)]">AutoQuiz</p>
          <p className="mt-1 text-xs text-[var(--fg-faint)]">© {new Date().getFullYear()} AutoQuiz.</p>
        </div>
      </footer>
    </div>
  );
}
