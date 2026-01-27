"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGeminiModel } from "@/lib/gemini";
import type {
  MockExam,
  EssayAnswer,
  EssayScore,
  MockExamResult,
  ExamFeedback,
  MCQQuestion,
  EssayQuestion
} from "@/types/mock-exam";

/**
 * Start a mock exam session (set to in_progress and record start time)
 */
export async function startMockExamSession(
  examId: string
): Promise<{ success: boolean; startTime: string }> {
  const supabase = await createSupabaseServerClient();

  // Authenticate user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  // Verify user owns this exam
  const { data: exam, error: fetchError } = await supabase
    .from("mock_exams")
    .select("status, time_limit_minutes")
    .eq("id", examId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !exam) {
    throw new Error("Exam not found or access denied");
  }

  if (exam.status !== "draft") {
    throw new Error("Exam has already been started");
  }

  // Start the exam
  const startTime = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("mock_exams")
    .update({
      status: "in_progress",
      started_at: startTime,
    })
    .eq("id", examId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(`Failed to start exam: ${updateError.message}`);
  }

  revalidatePath(`/dashboard/mock-exam/${examId}`);
  return { success: true, startTime };
}

/**
 * Save MCQ answers during exam
 */
export async function saveMCQAnswers(
  examId: string,
  answers: Record<number, string>
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // Authenticate user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  // Verify exam is in progress
  const { data: exam, error: fetchError } = await supabase
    .from("mock_exams")
    .select("status")
    .eq("id", examId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !exam) {
    throw new Error("Exam not found or access denied");
  }

  if (exam.status !== "in_progress") {
    throw new Error("Exam is not in progress");
  }

  // Save answers
  const { error: updateError } = await supabase
    .from("mock_exams")
    .update({ mcq_answers: answers })
    .eq("id", examId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(`Failed to save answers: ${updateError.message}`);
  }
}

/**
 * Save essay answers during exam
 */
export async function saveEssayAnswers(
  examId: string,
  essayAnswers: EssayAnswer[]
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // Authenticate user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  // Verify exam is in progress
  const { data: exam, error: fetchError } = await supabase
    .from("mock_exams")
    .select("status")
    .eq("id", examId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !exam) {
    throw new Error("Exam not found or access denied");
  }

  if (exam.status !== "in_progress") {
    throw new Error("Exam is not in progress");
  }

  // Save answers
  const { error: updateError } = await supabase
    .from("mock_exams")
    .update({ essay_answers: essayAnswers })
    .eq("id", examId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(`Failed to save essay answers: ${updateError.message}`);
  }
}

/**
 * Submit mock exam and calculate results
 */
export async function submitMockExam(
  examId: string,
  mcqAnswers: Record<number, string>,
  essayAnswers: EssayAnswer[]
): Promise<MockExamResult> {
  const supabase = await createSupabaseServerClient();

  // Authenticate user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  // Get exam data
  const { data: exam, error: fetchError } = await supabase
    .from("mock_exams")
    .select("*")
    .eq("id", examId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !exam) {
    throw new Error("Exam not found or access denied");
  }

  if (exam.status !== "in_progress") {
    throw new Error("Exam is not in progress");
  }

  // Calculate time spent
  const startedAt = new Date(exam.started_at!);
  const submittedAt = new Date();
  const timeSpentSeconds = Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000);

  // Grade MCQs
  const mcqQuestions = exam.mcq_questions as MCQQuestion[];
  const mcqResults = gradeMCQs(mcqQuestions, mcqAnswers);

  // Grade Essays using AI
  const essayQuestions = exam.essay_questions as EssayQuestion[];
  const essayScores = await gradeEssays(essayQuestions, essayAnswers);

  // Calculate total score
  const mcqTotal = mcqQuestions.length; // 30 points
  const essayTotal = essayQuestions.reduce((sum, q) => sum + q.maxPoints, 0); // Usually 40 points
  const totalPoints = mcqTotal + essayTotal;
  const earnedPoints = mcqResults.score + essayScores.reduce((sum, s) => sum + s.totalScore, 0);
  const totalPercentage = Math.round((earnedPoints / totalPoints) * 100 * 100) / 100; // Two decimal places

  // Generate feedback
  const feedback = await generateFeedback(mcqResults, essayScores, exam);

  // Update exam with results
  const { error: updateError } = await supabase
    .from("mock_exams")
    .update({
      status: "graded",
      submitted_at: submittedAt.toISOString(),
      time_spent_seconds: timeSpentSeconds,
      mcq_answers: mcqAnswers,
      essay_answers: essayAnswers,
      mcq_score: mcqResults.score,
      essay_scores: essayScores,
      total_score: totalPercentage,
      feedback,
    })
    .eq("id", examId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(`Failed to save results: ${updateError.message}`);
  }

  // Return results
  return {
    mcqScore: mcqResults.score,
    mcqTotal: mcqTotal,
    essayScores,
    totalPercentage,
    grade: getLetterGrade(totalPercentage),
    feedback,
    timeSpentMinutes: Math.floor(timeSpentSeconds / 60),
    topicsStrengths: mcqResults.topicsStrengths,
    topicsWeaknesses: mcqResults.topicsWeaknesses,
  };
}

/**
 * Grade multiple choice questions
 */
function gradeMCQs(
  questions: MCQQuestion[],
  answers: Record<number, string>
): { score: number; topicsStrengths: string[]; topicsWeaknesses: string[] } {
  let score = 0;
  const topicsStrengths: string[] = [];
  const topicsWeaknesses: string[] = [];
  const topicScores: Record<string, { correct: number; total: number }> = {};

  questions.forEach((question) => {
    const topic = question.topic;
    if (!topicScores[topic]) {
      topicScores[topic] = { correct: 0, total: 0 };
    }
    topicScores[topic].total++;

    const userAnswer = answers[question.id];
    if (userAnswer === question.correctAnswer) {
      score++;
      topicScores[topic].correct++;
    }
  });

  // Analyze topic performance
  Object.entries(topicScores).forEach(([topic, scores]) => {
    const percentage = (scores.correct / scores.total) * 100;
    if (percentage >= 80) {
      topicsStrengths.push(topic);
    } else if (percentage < 60) {
      topicsWeaknesses.push(topic);
    }
  });

  return { score, topicsStrengths, topicsWeaknesses };
}

/**
 * Grade essay questions using AI
 */
async function gradeEssays(
  questions: EssayQuestion[],
  answers: EssayAnswer[]
): Promise<EssayScore[]> {
  const model = await getGeminiModel();
  const scores: EssayScore[] = [];

  for (const question of questions) {
    const answer = answers.find(a => a.questionId === question.id);

    if (!answer || !answer.text.trim()) {
      scores.push({
        questionId: question.id,
        criteriaScores: [],
        totalScore: 0,
        maxScore: question.maxPoints,
        overallFeedback: "No answer provided.",
        timeSpentMinutes: 0,
      });
      continue;
    }

    try {
      const prompt = `Grade this essay answer using the provided rubric.

**Question:** ${question.question}
**Max Points:** ${question.maxPoints}
**Expected Length:** ${question.expectedLength}

**Student Answer:**
${answer.text}

**Grading Rubric:**
${JSON.stringify(question.rubric, null, 2)}

**Instructions:**
- Grade each criterion from 0 to its max points
- Provide specific feedback for each criterion
- Give an overall assessment
- Return ONLY valid JSON with this structure:
{
  "criteriaScores": [
    {
      "criterion": "Content Accuracy",
      "score": 8,
      "feedback": "Specific feedback here..."
    }
    // ... all criteria from rubric
  ],
  "totalScore": 18,
  "overallFeedback": "Overall assessment here..."
}

Be fair but rigorous in grading. Consider depth of analysis, accuracy, and writing quality.`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();

      // Clean up response
      if (text.startsWith("```json")) {
        text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (text.startsWith("```")) {
        text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }

      const grading = JSON.parse(text);

      // Validate scoring
      if (!grading.criteriaScores || !Array.isArray(grading.criteriaScores)) {
        throw new Error("Invalid grading response");
      }

      scores.push({
        questionId: question.id,
        criteriaScores: grading.criteriaScores,
        totalScore: grading.totalScore || 0,
        maxScore: question.maxPoints,
        overallFeedback: grading.overallFeedback || "No feedback provided.",
        timeSpentMinutes: answer.timeSpentMinutes,
      });
    } catch (error) {
      console.error("Essay grading error:", error);
      scores.push({
        questionId: question.id,
        criteriaScores: [],
        totalScore: 0,
        maxScore: question.maxPoints,
        overallFeedback: "Error during grading. Please review manually.",
        timeSpentMinutes: answer.timeSpentMinutes,
      });
    }
  }

  return scores;
}

/**
 * Generate comprehensive feedback using AI
 */
async function generateFeedback(
  mcqResults: { score: number; topicsStrengths: string[]; topicsWeaknesses: string[] },
  essayScores: EssayScore[],
  exam: MockExam
): Promise<ExamFeedback> {
  const model = await getGeminiModel();

  const mcqPercentage = (mcqResults.score / 30) * 100;
  const essayTotal = essayScores.reduce((sum, s) => sum + s.maxScore, 0);
  const essayEarned = essayScores.reduce((sum, s) => sum + s.totalScore, 0);
  const essayPercentage = essayTotal > 0 ? (essayEarned / essayTotal) * 100 : 0;

  const prompt = `Generate personalized feedback for a student who completed a mock exam.

**Performance Summary:**
- Overall Score: ${Math.round((mcqResults.score + essayEarned) / (30 + essayTotal) * 100)}%
- Multiple Choice: ${Math.round(mcqPercentage)}% (${mcqResults.score}/30)
- Essays: ${Math.round(essayPercentage)}% (${essayEarned}/${essayTotal})
- Time Spent: ${exam.time_spent_seconds ? Math.floor(exam.time_spent_seconds / 60) : 'Unknown'} minutes
- Topics Mastered: ${mcqResults.topicsStrengths.join(', ')}
- Topics Needing Work: ${mcqResults.topicsWeaknesses.join(', ')}

**Documents Covered:** ${exam.source_filenames.join(', ')}

**Essay Performance:**
${essayScores.map(s => `- Essay ${s.questionId}: ${Math.round((s.totalScore / s.maxScore) * 100)}% - ${s.overallFeedback}`).join('\n')}

Generate personalized, encouraging feedback in this JSON format:
{
  "strengths": ["Specific strength 1", "Specific strength 2"],
  "areasForImprovement": ["Specific area 1", "Specific area 2"],
  "studyRecommendations": ["Specific recommendation 1", "Specific recommendation 2"],
  "predictedGrade": "A-",
  "nextSteps": ["Next step 1", "Next step 2"]
}

Make feedback actionable and specific to the student's performance.`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Clean up response
    if (text.startsWith("```json")) {
      text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    const feedback = JSON.parse(text);
    return feedback as ExamFeedback;
  } catch (error) {
    console.error("Feedback generation error:", error);
    // Return basic feedback if AI fails
    return {
      strengths: ["Completed the exam"],
      areasForImprovement: ["Review all materials"],
      studyRecommendations: ["Practice more questions"],
      predictedGrade: getLetterGrade((mcqResults.score + essayEarned) / (30 + essayTotal) * 100),
      nextSteps: ["Review incorrect answers"],
    };
  }
}

/**
 * Convert percentage to letter grade
 */
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