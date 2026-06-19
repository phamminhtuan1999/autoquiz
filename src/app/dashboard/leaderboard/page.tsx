"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { getLeaderboard, updateUniversity } from "@/actions/get-leaderboard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

type LeaderboardEntry = {
  userId: string;
  name: string;
  university: string;
  questionsAnswered: number;
  correctAnswers: number;
};

type Profile = { id: string; university?: string; full_name?: string };

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [newUniversity, setNewUniversity] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  async function fetchData() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setUserProfile(profile);
      if (profile?.university) setNewUniversity(profile.university);
      const res = await getLeaderboard();
      if (res.leaderboard) setLeaderboard(res.leaderboard);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const handleUpdateUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniversity) return;
    setIsUpdating(true);
    const res = await updateUniversity(newUniversity);
    if (res.success) {
      setUserProfile((p) => p ? { ...p, university: newUniversity } : null);
      const lRes = await getLeaderboard();
      if (lRes.leaderboard) setLeaderboard(lRes.leaderboard);
    }
    setIsUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      </div>
    );
  }

  const campusEntries = leaderboard.filter(
    (e) => e.university.toLowerCase() === userProfile?.university?.toLowerCase()
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg-strong)]">
            Leaderboards
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Progress, not competition.</p>
        </div>
        <Link href="/dashboard" className="text-sm text-[var(--accent)] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* University input */}
      <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg-subtle)] p-5">
        <p className="mb-3 text-sm font-medium text-[var(--fg)]">Your institution</p>
        <form onSubmit={handleUpdateUniversity} className="flex gap-3">
          <input
            type="text"
            placeholder="University name"
            value={newUniversity}
            onChange={(e) => setNewUniversity(e.target.value)}
            className="flex-1 rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent-border)] transition-colors"
          />
          <Button type="submit" variant="primary" size="sm" isDisabled={isUpdating}>
            {isUpdating ? "Saving…" : "Save"}
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LeaderboardTable
          title="Global"
          subtitle="Top 10 this week"
          data={leaderboard.slice(0, 10)}
          currentUserId={userProfile?.id}
        />
        <LeaderboardTable
          title={userProfile?.university || "Campus"}
          subtitle="Top 10 this week"
          data={campusEntries.slice(0, 10)}
          currentUserId={userProfile?.id}
          empty={!userProfile?.university ? "Set your institution above to see campus rankings." : undefined}
        />
      </div>
    </div>
  );
}

function LeaderboardTable({
  title,
  subtitle,
  data,
  currentUserId,
  empty,
}: {
  title: string;
  subtitle: string;
  data: LeaderboardEntry[];
  currentUserId?: string;
  empty?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-[var(--fg-strong)]">{title}</h2>
        <span className="font-mono text-xs text-[var(--fg-faint)]">{subtitle}</span>
      </div>
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)]">
        {data.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
            {empty ?? "No activity recorded yet."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Student</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">Questions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.map((entry, i) => (
                <tr
                  key={entry.userId}
                  className={`transition-colors hover:bg-[var(--bg-subtle)] ${entry.userId === currentUserId ? "bg-[var(--accent-subtle)]" : ""}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-[var(--fg-faint)]">{i + 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--fg)]">{entry.name}</p>
                    <p className="text-xs text-[var(--fg-muted)]">{entry.university}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-mono font-semibold text-[var(--accent)]">{entry.questionsAnswered}</p>
                    <p className="font-mono text-xs text-[var(--fg-faint)]">
                      {entry.questionsAnswered > 0
                        ? Math.round((entry.correctAnswers / entry.questionsAnswered) * 100)
                        : 0}% acc
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
