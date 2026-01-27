"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGeminiModel } from "@/lib/gemini";
import type {
  MockExamContent,
  GenerateMockExamInput
} from "@/types/mock-exam";

const MOCK_EXAM_CREDIT_COST = 5;

/**
 * Generate a comprehensive mock exam from multiple PDF documents
 */
export async function generateMockExam(
  input: GenerateMockExamInput
): Promise<{ examId: string; content: MockExamContent }> {
  // 1. Validate input (1-5 documents)
  if (!input.documentTexts?.length || input.documentTexts.length > 5) {
    throw new Error("Please select 1-5 PDF documents");
  }

  // Check total text length to prevent API abuse
  const totalTextLength = input.documentTexts.reduce((sum, doc) => sum + doc.text.length, 0);
  if (totalTextLength > 75_000) { // ~15K per doc * 5 docs
    throw new Error("Combined documents exceed processing limit. Please select smaller documents.");
  }

  const supabase = await createSupabaseServerClient();

  // 2. Auth & credit check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Failed to fetch user profile");
  }

  if (profile.credits < MOCK_EXAM_CREDIT_COST) {
    throw new Error(`Insufficient credits. Mock Exam requires ${MOCK_EXAM_CREDIT_COST} credits.`);
  }

  // 3. Generate exam content via Gemini
  const content = await callGeminiForMockExam(input);

  // 4. Store in database
  const { data: exam, error: insertError } = await supabase
    .from("mock_exams")
    .insert({
      user_id: user.id,
      title: input.title || `Mock Exam: ${input.documentTexts.map(d => d.filename.replace(/\.pdf$/i, "")).join(" + ")}`,
      source_filenames: input.documentTexts.map(d => d.filename),
      time_limit_minutes: 60,
      mcq_questions: content.mcqQuestions,
      essay_questions: content.essayQuestions,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to save mock exam: ${insertError.message}`);
  }

  // 5. Deduct credits
  const { error: deductError } = await supabase.rpc("deduct_credits", {
    p_user_id: user.id,
    p_amount: MOCK_EXAM_CREDIT_COST,
  } as never);

  if (deductError) {
    // If credit deduction fails, try to delete the exam entry to maintain consistency
    await supabase
      .from("mock_exams")
      .delete()
      .eq("id", exam.id);
    throw new Error(`Failed to deduct credits: ${deductError.message}. Mock exam was not saved.`);
  }

  revalidatePath("/dashboard/mock-exam");
  return { examId: exam.id, content };
}

/**
 * Call Gemini API with Mock Exam specific prompt
 */
async function callGeminiForMockExam(input: GenerateMockExamInput): Promise<MockExamContent> {
  const model = await getGeminiModel();
  let responseText = "";

  // Prepare document text for prompt
  const documentsText = input.documentTexts
    .map((d, i) => `
--- DOCUMENT ${i + 1}: ${d.filename} ---
${d.text.slice(0, 15_000)}
    `.trim())
    .join('\n\n');

  const prompt = `You are an expert exam designer creating a comprehensive mock final exam.

**Source Materials:**
${documentsText}

**Your Task:**
Create a 60-minute mock exam that simulates a real university final exam. The exam should test comprehensive understanding across all provided materials.

PART A: Multiple Choice Questions (30 questions)
- Distribute questions evenly across all source documents
- Include varying difficulty: 10 easy, 15 medium, 5 hard
- Each question tests specific concepts from the materials
- Provide clear, unambiguous correct answers with explanations
- Questions should require critical thinking, not just recall

PART B: Essay Questions (2 questions)
- Questions should synthesize information across multiple documents
- Include detailed grading rubrics with 4 scoring levels
- Provide sample answers for reference
- Allocate appropriate time: Essay 1 (15 min), Essay 2 (10 min)

**Return ONLY valid JSON with this exact structure:**
{
  "mcqQuestions": [
    {
      "id": 1,
      "question": "Clear question text that tests understanding",
      "options": ["A) Clear option 1", "B) Clear option 2", "C) Clear option 3", "D) Clear option 4"],
      "correctAnswer": "A) Clear option 1",
      "explanation": "Clear explanation of why this is correct",
      "sourceDocument": "filename.pdf",
      "topic": "Topic name",
      "difficulty": "medium"
    }
    // ... exactly 30 total questions
  ],
  "essayQuestions": [
    {
      "id": 1,
      "question": "Thought-provoking question requiring synthesis",
      "expectedLength": "medium",
      "maxPoints": 20,
      "suggestedMinutes": 15,
      "rubric": {
        "criteria": [
          {
            "name": "Content Accuracy",
            "description": "Accuracy of information and concepts",
            "maxPoints": 8,
            "levels": [
              {"score": 8, "label": "Excellent", "description": "All information accurate and well-integrated"},
              {"score": 6, "label": "Good", "description": "Most information accurate with minor errors"},
              {"score": 4, "label": "Fair", "description": "Some accurate information with notable errors"},
              {"score": 2, "label": "Poor", "description": "Significant factual errors"}
            ]
          },
          {
            "name": "Analysis Depth",
            "description": "Critical thinking and synthesis",
            "maxPoints": 7,
            "levels": [
              {"score": 7, "label": "Excellent", "description": "Insightful analysis with multiple perspectives"},
              {"score": 5, "label": "Good", "description": "Solid analysis with clear reasoning"},
              {"score": 3, "label": "Fair", "description": "Basic analysis with limited depth"},
              {"score": 1, "label": "Poor", "description": "Minimal or no analysis"}
            ]
          },
          {
            "name": "Writing Quality",
            "description": "Clarity, organization, and academic tone",
            "maxPoints": 5,
            "levels": [
              {"score": 5, "label": "Excellent", "description": "Clear, well-organized, academic tone"},
              {"score": 4, "label": "Good", "description": "Generally clear with minor organization issues"},
              {"score": 2, "label": "Fair", "description": "Some clarity or organization problems"},
              {"score": 1, "label": "Poor", "description": "Difficult to understand or poorly organized"}
            ]
          }
        ],
        "totalPoints": 20
      },
      "sampleAnswer": "A comprehensive sample answer demonstrating expected quality",
      "sourceDocuments": ["doc1.pdf", "doc2.pdf"]
    }
    // ... exactly 2 total questions
  ],
  "totalTimeMinutes": 60,
  "generatedAt": "ISO timestamp",
  "topicsCovered": ["Topic 1", "Topic 2", "Topic 3"]
}

**CRITICAL REQUIREMENTS:**
- Return ONLY the JSON object, no markdown, no code blocks
- Ensure exactly 30 MCQ questions and 2 essay questions
- Questions must be based on the provided documents
- All options should be plausible but only one correct
- Essay rubrics must have clear, gradable criteria
- Time allocation should be realistic (35 min MCQ, 25 min essays)`;

  try {
    const result = await model.generateContent(prompt);
    responseText = result.response.text().trim();

    // Remove markdown code blocks if present
    if (responseText.startsWith("```json")) {
      responseText = responseText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    const payload = JSON.parse(responseText) as MockExamContent;

    // Validate structure
    if (!payload.mcqQuestions || !Array.isArray(payload.mcqQuestions)) {
      throw new Error("Missing or invalid 'mcqQuestions' field");
    }
    if (!payload.essayQuestions || !Array.isArray(payload.essayQuestions)) {
      throw new Error("Missing or invalid 'essayQuestions' field");
    }

    // Validate question counts
    if (payload.mcqQuestions.length !== 30) {
      throw new Error(`Expected 30 MCQ questions, got ${payload.mcqQuestions.length}`);
    }
    if (payload.essayQuestions.length !== 2) {
      throw new Error(`Expected 2 essay questions, got ${payload.essayQuestions.length}`);
    }

    // Validate MCQ structure
    payload.mcqQuestions.forEach((q, index) => {
      if (!q.question || !q.options || q.options.length !== 4 || !q.correctAnswer) {
        throw new Error(`Invalid MCQ question structure at index ${index}`);
      }
      if (!q.options.includes(q.correctAnswer)) {
        throw new Error(`Correct answer not in options for MCQ question ${index + 1}`);
      }
    });

    // Validate Essay structure
    payload.essayQuestions.forEach((q, index) => {
      if (!q.question || !q.rubric || !q.rubric.criteria) {
        throw new Error(`Invalid essay question structure at index ${index}`);
      }
    });

    // Add generated timestamp if not present
    if (!payload.generatedAt) {
      payload.generatedAt = new Date().toISOString();
    }

    return payload;
  } catch (error) {
    console.error("Gemini API response:", responseText);
    throw new Error(
      `Failed to generate mock exam: ${(error as Error).message}`
    );
  }
}