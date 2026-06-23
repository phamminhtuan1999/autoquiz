import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MCQQuestion } from "@/types/mock-exam";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();

    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { examId } = await params;

    // Fetch exam with user verification
    const { data: exam, error: examError } = await supabase
      .from("mock_exams")
      .select("*")
      .eq("id", examId)
      .eq("user_id", user.id)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ error: "Exam not found or access denied" }, { status: 404 });
    }

    if (exam.status !== "graded") {
      return NextResponse.json({ error: "Exam results not available yet" }, { status: 400 });
    }

    // Prepare results data
    const results = {
      mcqScore: exam.mcq_score || 0,
      mcqTotal: 30, // Fixed based on our mock exam structure
      essayScores: exam.essay_scores || [],
      totalPercentage: exam.total_score || 0,
      grade: getLetterGrade(exam.total_score || 0),
      feedback: exam.feedback || {
        strengths: [],
        areasForImprovement: [],
        studyRecommendations: [],
        predictedGrade: getLetterGrade(exam.total_score || 0),
        nextSteps: [],
      },
      timeSpentMinutes: Math.floor((exam.time_spent_seconds || 0) / 60),
      topicsStrengths: extractTopicsStrengths(exam.mcq_questions || [], exam.mcq_answers || {}),
      topicsWeaknesses: extractTopicsWeaknesses(exam.mcq_questions || [], exam.mcq_answers || {}),
    };

    return NextResponse.json({ exam, results });
  } catch (error) {
    console.error("Error fetching exam results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getLetterGrade(percentage: number): string {
  if (percentage >= 97) return "A+";
  if (percentage >= 93) return "A";
  if (percentage >= 90) return "A-";
  if (percentage >= 87) return "B+";
  if (percentage >= 83) return "B";
  if (percentage >= 80) return "B-";
  if (percentage >= 77) return "C+";
  if (percentage >= 73) return "C";
  if (percentage >= 70) return "C-";
  if (percentage >= 67) return "D+";
  if (percentage >= 63) return "D";
  if (percentage >= 60) return "D-";
  return "F";
}

function extractTopicsStrengths(mcqQuestions: MCQQuestion[], mcqAnswers: Record<number, string>): string[] {
  const topicScores: Record<string, { correct: number; total: number }> = {};

  mcqQuestions.forEach((question) => {
    const topic = question.topic;
    if (!topic) return;

    if (!topicScores[topic]) {
      topicScores[topic] = { correct: 0, total: 0 };
    }
    topicScores[topic].total++;

    const userAnswer = mcqAnswers[question.id];
    if (userAnswer === question.correctAnswer) {
      topicScores[topic].correct++;
    }
  });

  return Object.entries(topicScores)
    .filter(([, scores]) => (scores.correct / scores.total) >= 0.8)
    .map(([topic]) => topic);
}

function extractTopicsWeaknesses(mcqQuestions: MCQQuestion[], mcqAnswers: Record<number, string>): string[] {
  const topicScores: Record<string, { correct: number; total: number }> = {};

  mcqQuestions.forEach((question) => {
    const topic = question.topic;
    if (!topic) return;

    if (!topicScores[topic]) {
      topicScores[topic] = { correct: 0, total: 0 };
    }
    topicScores[topic].total++;

    const userAnswer = mcqAnswers[question.id];
    if (userAnswer === question.correctAnswer) {
      topicScores[topic].correct++;
    }
  });

  return Object.entries(topicScores)
    .filter(([, scores]) => (scores.correct / scores.total) < 0.6)
    .map(([topic]) => topic);
}