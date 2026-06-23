"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getLeaderboard(university: string | null = null) {
  const supabase = await createSupabaseServerClient();
  
  // Get start of current week (Monday)
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  let query = supabase
    .from("question_attempts")
    .select(`
      user_id,
      is_correct,
      profiles (
        full_name,
        university,
        email
      )
    `)
    .gte("created_at", monday.toISOString());

  if (university) {
    // This is a bit tricky with nested filtering in Supabase, 
    // better to filter in JS or use a joined query if possible.
    // Let's assume we want to filter by the profiles.university column.
    query = query.filter("profiles.university", "eq", university);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching leaderboard:", error);
    return { error: error.message };
  }

  // Aggregate by user
  type LeaderboardEntry = {
    userId: string;
    name: string;
    university: string;
    questionsAnswered: number;
    correctAnswers: number;
  };

  const aggregation: Record<string, LeaderboardEntry> = {};

  interface AttemptData {
    user_id: string;
    is_correct: boolean;
    profiles: {
      full_name: string | null;
      university: string | null;
      email: string | null;
    } | null;
  }

  data?.forEach((attempt) => {
    const typedAttempt = attempt as unknown as AttemptData;
    const profile = typedAttempt.profiles;
    if (!profile) return;
    
    if (!aggregation[typedAttempt.user_id]) {
      aggregation[typedAttempt.user_id] = {
        userId: typedAttempt.user_id,
        name: profile.full_name || profile.email || "Anonymous",
        university: profile.university || "Unknown",
        questionsAnswered: 0,
        correctAnswers: 0,
      };
    }
    
    aggregation[typedAttempt.user_id].questionsAnswered += 1;
    if (typedAttempt.is_correct) {
      aggregation[typedAttempt.user_id].correctAnswers += 1;
    }
  });

  const leaderboard = Object.values(aggregation).sort((a, b) => b.questionsAnswered - a.questionsAnswered);

  return { leaderboard };
}

export async function updateUniversity(university: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ university })
    .eq("id", user.id);

  if (error) {
    console.error("Error updating university:", error);
    return { error: error.message };
  }

  return { success: true };
}
