"use client";

import Link from "next/link";
import { Button } from "@heroui/react";

interface NavItem {
  label: string;
  href: string;
  badge?: number;
  active?: boolean;
}

interface TeacherConsoleProps {
  children: React.ReactNode;
  navItems?: NavItem[];
  onGenerate?: () => void;
}

const DEFAULT_NAV: NavItem[] = [
  { label: "Review queue", href: "/dashboard/review", badge: 0 },
  { label: "Question bank", href: "/dashboard/bank" },
  { label: "Flashcards", href: "/dashboard/flashcards" },
];

export function TeacherConsole({ children, navItems = DEFAULT_NAV, onGenerate }: TeacherConsoleProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Left rail ~184px */}
      <aside className="flex w-46 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <Link
            href="/dashboard"
            className="font-display text-base font-bold text-[var(--fg-strong)] hover:text-[var(--accent)] transition-colors"
          >
            AutoQuiz
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
            Workspace
          </p>
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center justify-between rounded-[var(--r-sm)] px-2 py-1.5 text-[13px] transition-colors ${
                    item.active
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-medium"
                      : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  {item.label}
                  {item.badge != null && item.badge > 0 && (
                    <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[10px] text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <Button variant="primary" size="sm" className="w-full" onPress={onGenerate}>
            + Generate
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar 46px */}
        <header className="flex h-[46px] shrink-0 items-center border-b border-[var(--border)] bg-[var(--bg)] px-4 gap-4">
          <div className="flex-1" />
        </header>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
