"use client";

import { useEffect, useState } from "react";
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

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [newUniversity, setNewUniversity] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      setUserProfile(profile);
      if (profile?.university) {
        setNewUniversity(profile.university);
      }

      const res = await getLeaderboard();
      if (res.leaderboard) {
        setLeaderboard(res.leaderboard);
      }
    }
    setLoading(false);
  }

  const handleUpdateUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniversity) return;

    setIsUpdating(true);
    const res = await updateUniversity(newUniversity);
    if (res.success) {
      setUserProfile({ ...userProfile, university: newUniversity });
      // Refresh leaderboard to show current uni context if needed
      const lRes = await getLeaderboard();
      if (lRes.leaderboard) setLeaderboard(lRes.leaderboard);
    }
    setIsUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  const userUniversityLeaderboard = leaderboard.filter(
    (entry) => entry.university.toLowerCase() === userProfile?.university?.toLowerCase()
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900">Campus Leaderboards</h1>
          <p className="text-slate-500">Who is studying the hardest this week?</p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* University Selection */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-2">My University</h2>
        <form onSubmit={handleUpdateUniversity} className="flex gap-4">
          <input
            type="text"
            placeholder="Enter your University Name"
            value={newUniversity}
            onChange={(e) => setNewUniversity(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isUpdating}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isUpdating ? "Updating..." : "Update"}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Set your university to see how you rank among your peers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Global Leaderboard */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>🌎</span> Global Rankings
            </h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Weekly Top 10</span>
          </div>
          <LeaderboardTable data={leaderboard.slice(0, 10)} currentUserId={userProfile?.id} />
        </div>

        {/* Campus Leaderboard */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>🏫</span> {userProfile?.university || "Campus"} Rankings
            </h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Weekly Top 10</span>
          </div>
          {userProfile?.university ? (
            <LeaderboardTable data={userUniversityLeaderboard.slice(0, 10)} currentUserId={userProfile?.id} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-500 italic">Set your university above to see your campus leaderboard.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardTable({ data, currentUserId }: { data: LeaderboardEntry[], currentUserId?: string }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">No activity recorded yet for this week.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3 text-right">Questions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((entry, index) => (
            <tr 
              key={entry.userId} 
              className={`${entry.userId === currentUserId ? 'bg-indigo-50/50' : ''} transition hover:bg-slate-50`}
            >
              <td className="px-4 py-4">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-slate-200 text-slate-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'text-slate-500'
                }`}>
                  {index + 1}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-900">{entry.name}</div>
                <div className="text-xs text-slate-500">{entry.university}</div>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="font-bold text-indigo-600">{entry.questionsAnswered}</div>
                <div className="text-[10px] text-slate-400 uppercase font-medium">
                  {Math.round((entry.correctAnswers / entry.questionsAnswered) * 100)}% accuracy
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
