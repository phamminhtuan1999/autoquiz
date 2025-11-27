import { GoogleGenerativeAI } from "@google/generative-ai";

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
};

export type Difficulty = "easy" | "medium" | "hard";

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return apiKey;
}

let cachedModelName: string | null = null;

async function getAvailableModel(): Promise<string> {
  // If we have a cached model name, use it
  if (cachedModelName) {
    return cachedModelName;
  }

  const apiKey = getGeminiApiKey();

  // Try to fetch available models from the API
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    const models = data.models || [];

    // Prefer models that support generateContent and are stable
    const preferredModels = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite"];

    // Find the first available model from our preferred list
    for (const preferred of preferredModels) {
      const model = models.find(
        (m: { name: string; supportedGenerationMethods?: string[] }) =>
          m.name.includes(preferred) &&
          m.supportedGenerationMethods?.includes("generateContent")
      );
      if (model) {
        // Extract model name (format: models/gemini-1.5-flash)
        const modelName = model.name.replace("models/", "");
        cachedModelName = modelName;
        return modelName;
      }
    }

    // Fallback: find any model that supports generateContent
    const anyModel = models.find(
      (m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent")
    );
    if (anyModel) {
      const modelName = anyModel.name.replace("models/", "");
      cachedModelName = modelName;
      return modelName;
    }

    throw new Error("No available models found that support generateContent");
  } catch (error) {
    console.warn(
      "Failed to fetch available models, using fallback:",
      (error as Error).message
    );
    // Fallback to environment variable or default
    return process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  }
}

async function getGeminiModel() {
  const genAI = new GoogleGenerativeAI(getGeminiApiKey());
  const modelName = await getAvailableModel();
  return genAI.getGenerativeModel({
    model: modelName,
  });
}

export async function callGemini(
  documentText: string,
  questionCount: number = 10,
  difficulty: Difficulty = "medium"
): Promise<QuizQuestion[]> {
  const model = await getGeminiModel();
  const difficultyInstructions = {
    easy: "Create straightforward questions that test basic recall and understanding. Use clear language and obvious correct answers.",
    medium:
      "Create questions that require comprehension and some analysis. Include plausible distractors that test common misconceptions.",
    hard: "Create challenging questions that require critical thinking, synthesis of information, and careful analysis. Use subtle distractors that require deep understanding.",
  };

  const prompt = `You are an expert instructional designer. Generate a JSON array of quiz questions based on the provided document.

Requirements:
- Return ONLY a valid JSON array, no markdown, no code blocks, no explanations
- Each question must have: "question" (string), "options" (array of exactly 4 strings), "answer" (string matching one of the options), "explanation" (string, optional)
- Generate exactly ${questionCount} questions based on the document content
- Base questions strictly on the provided document text
- Difficulty level: ${difficulty}. ${difficultyInstructions[difficulty]}

Document:\n${documentText.slice(0, 15_000)}`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();

  // Remove markdown code blocks if present
  if (text.startsWith("```json")) {
    text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } else if (text.startsWith("```")) {
    text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const payload = JSON.parse(text);
    if (!Array.isArray(payload)) {
      throw new Error("Gemini response was not an array");
    }
    return payload as QuizQuestion[];
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini response: ${(error as Error).message}`
    );
  }
}
