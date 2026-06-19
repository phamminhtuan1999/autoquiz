"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  BarChart2,
  ClipboardList,
  Trophy,
  BookOpen,
  Plus,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Review queue", href: "/dashboard/review", icon: CheckSquare },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart2 },
  { label: "Mock exams", href: "/dashboard/mock-exam", icon: ClipboardList },
  { label: "Leaderboard", href: "/dashboard/leaderboard", icon: Trophy },
  { label: "Cram mode", href: "/dashboard/cram", icon: BookOpen },
];

interface AppSidebarProps {
  username?: string;
}

export function AppSidebar({ username }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  const sidebarContent = (
    <aside
      className="flex h-full w-[200px] flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-subtle)]"
      style={{ contain: "strict" }}
    >
      {/* Logo */}
      <div className="flex h-[46px] items-center border-b border-[var(--border)] px-4">
        <Link
          href="/"
          className="font-display text-base font-bold text-[var(--fg-strong)] transition-colors hover:text-[var(--accent)]"
          onClick={() => setMobileOpen(false)}
        >
          AutoQuiz
        </Link>
      </div>

      {/* Generate button */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/"
          className="flex w-full items-center gap-2 rounded-[var(--r-sm)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
          onClick={() => setMobileOpen(false)}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Generate quiz
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 pt-1">
        <ul className="space-y-0.5">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-[var(--r-sm)] px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[var(--accent-subtle)] font-medium text-[var(--accent)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 flex-shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--fg-subtle)]"}`}
                    strokeWidth={active ? 2 : 1.75}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: user + actions */}
      <div className="border-t border-[var(--border)] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          {username ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[10px] font-bold text-[var(--accent)]">
                {username[0].toUpperCase()}
              </div>
              <span className="truncate font-mono text-xs text-[var(--fg-muted)]">{username}</span>
            </div>
          ) : (
            <span className="text-xs text-[var(--fg-faint)]">Not signed in</span>
          )}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ThemeToggle />
            {username && (
              <button
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">{sidebarContent}</div>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)] lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--fg)]/20"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <div className="relative h-full">
              {sidebarContent}
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 rounded p-1 text-[var(--fg-faint)] hover:text-[var(--fg-muted)]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
