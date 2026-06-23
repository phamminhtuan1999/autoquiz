/**
 * Cram Mode Types
 * Premium 3-credit feature for rapid exam preparation
 */

/**
 * Golden Nugget: A single high-yield fact, definition, or formula
 */
export interface GoldenNugget {
  /**
   * The key concept or topic being highlighted
   */
  topic: string;

  /**
   * The critical information to remember
   */
  content: string;
}

/**
 * Blitz Question: A rapid-fire flashcard-style question
 */
export interface BlitzQuestion {
  /**
   * The question text
   */
  question: string;

  /**
   * The answer to reveal
   */
  answer: string;
}

/**
 * Complete Cram Mode result returned from AI
 */
export interface CramResult {
  /**
   * Top 10 most critical facts/definitions/formulas
   */
  summary: GoldenNugget[];

  /**
   * 20 rapid-fire questions for quick review
   */
  blitz_questions: BlitzQuestion[];
}

/**
 * Input parameters for generating a Cram Mode session
 */
export interface GenerateCramInput {
  /**
   * The document text to analyze
   */
  documentText: string;

  /**
   * Optional title for the cram session
   */
  title?: string;

  /**
   * Optional filename for tracking
   */
  filename?: string;
}
