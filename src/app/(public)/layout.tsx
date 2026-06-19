import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AuthButton } from "@/components/auth-button";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]">
        <nav className="mx-auto flex h-[46px] max-w-5xl items-center justify-between px-4 sm:px-8">
          <Link
            href="/"
            className="font-display text-base font-bold text-[var(--fg-strong)] transition-colors hover:text-[var(--accent)]"
          >
            AutoQuiz
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden text-sm text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)] sm:block"
            >
              Dashboard
            </Link>
            <AuthButton />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      {children}
    </>
  );
}
