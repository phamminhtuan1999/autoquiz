"use client";

import { useCallback, useRef } from "react";
import type { EssayQuestion, EssayAnswer } from "@/types/mock-exam";

interface EssaySectionProps {
  questions: EssayQuestion[];
  answers: EssayAnswer[];
  onAnswerChange: (answers: EssayAnswer[]) => void;
  currentQuestion: number;
  onQuestionChange: (questionId: number) => void;
  timeRemaining?: number;
  showReview?: boolean;
}

export function EssaySection({
  questions,
  answers,
  onAnswerChange,
  currentQuestion,
  onQuestionChange,
  timeRemaining,
  showReview = false,
}: EssaySectionProps) {
  const currentQuestionData = questions.find(q => q.id === currentQuestion);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get current answer
  const currentAnswer = answers.find(a => a.questionId === currentQuestion);
  // Handle text change
  const handleTextChange = useCallback((text: string) => {
    // Update answers array
    const updatedAnswers = answers.map(a =>
      a.questionId === currentQuestion
        ? { ...a, text }
        : a
    );

    // Add answer if it doesn't exist
    if (!updatedAnswers.find(a => a.questionId === currentQuestion)) {
      updatedAnswers.push({
        questionId: currentQuestion,
        text,
        timeSpentMinutes: 0, // Will be calculated on submit
      });
    }

    onAnswerChange(updatedAnswers);
  }, [currentQuestion, answers, onAnswerChange]);

  // Navigate between questions
  const navigateToQuestion = useCallback((questionId: number) => {
    onQuestionChange(questionId);
  }, [onQuestionChange]);

  // Calculate word count and character count
  const wordCount = (currentAnswer?.text || "").trim().split(/\s+/).filter(word => word.length > 0).length;
  const charCount = (currentAnswer?.text || "").length;

  // Get recommended length based on expected length
  const getRecommendedLength = (expectedLength: string): { min: number; max: number; unit: string } => {
    switch (expectedLength) {
      case "short":
        return { min: 150, max: 300, unit: "words" };
      case "medium":
        return { min: 300, max: 600, unit: "words" };
      case "long":
        return { min: 600, max: 1000, unit: "words" };
      default:
        return { min: 250, max: 500, unit: "words" };
    }
  };

  const recommended = currentQuestionData ? getRecommendedLength(currentQuestionData.expectedLength) : null;
  const isInRecommendedRange = recommended ? wordCount >= recommended.min && wordCount <= recommended.max : true;

  if (!currentQuestionData) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Question not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Question Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Essay Question {questions.findIndex(q => q.id === currentQuestion) + 1} of {questions.length}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            {currentQuestionData.expectedLength} essay • {currentQuestionData.maxPoints} points • {currentQuestionData.suggestedMinutes} min
          </span>
        </div>
        {timeRemaining !== undefined && (
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Time remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Question */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700">
        <div className="mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
            Sources: {currentQuestionData.sourceDocuments.join(" • ")}
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {currentQuestionData.question}
          </h2>
          {recommended && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Recommended length: {recommended.min}-{recommended.max} {recommended.unit}
            </p>
          )}
        </div>

        {/* Rubric Preview */}
        <div className="mb-6 p-4 bg-slate-50 rounded-lg dark:bg-slate-700/50">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Grading Rubric</h3>
          <div className="space-y-2 text-xs">
            {currentQuestionData.rubric.criteria.map((criterion, index) => (
              <div key={index} className="flex justify-between">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  {criterion.name}
                </span>
                <span className="text-slate-500 dark:text-slate-500">
                  {criterion.maxPoints} points
                </span>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-600">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{currentQuestionData.rubric.totalPoints} points</span>
              </div>
            </div>
          </div>
        </div>

        {/* Answer Area */}
        <div className="space-y-4">
          <label htmlFor={`essay-${currentQuestion}`} className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Your Answer:
            </span>
          </label>

          <textarea
            ref={textareaRef}
            id={`essay-${currentQuestion}`}
            value={currentAnswer?.text || ""}
            onChange={(e) => !showReview && handleTextChange(e.target.value)}
            disabled={showReview}
            rows={15}
            className={`
              w-full px-4 py-3 rounded-lg border-2 resize-none font-mono text-sm
              ${showReview
                ? "bg-slate-50 border-slate-200 dark:bg-slate-700/50 dark:border-slate-600"
                : "bg-white border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800 dark:border-slate-700 dark:focus:border-indigo-500"
              }
            `}
            placeholder={
              showReview
                ? "No answer provided"
                : "Type your answer here. Be comprehensive and address all aspects of the question..."
            }
          />

          {/* Character and Word Count */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-4">
              <span>{charCount} characters</span>
              <span>{wordCount} words</span>
            </div>
            {recommended && (
              <div className="flex items-center gap-2">
                <span className={
                  isInRecommendedRange ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                }>
                  {isInRecommendedRange ? "✓" : "⚠️"} {recommended.min}-{recommended.max} words recommended
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Mode - Show Sample Answer */}
      {showReview && currentQuestionData.sampleAnswer && (
        <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-6 dark:bg-blue-900/20 dark:border-blue-800">
          <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">Sample Answer</h3>
          <p className="text-sm text-blue-700 dark:text-blue-400 whitespace-pre-wrap">
            {currentQuestionData.sampleAnswer}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateToQuestion(questions[Math.max(0, questions.findIndex(q => q.id === currentQuestion) - 1)].id)}
          disabled={questions.findIndex(q => q.id === currentQuestion) === 0}
          className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {(currentAnswer?.text || "").trim().length > 0 ? "✓" : "○"} {wordCount} words written
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigateToQuestion(questions[Math.min(questions.length - 1, questions.findIndex(q => q.id === currentQuestion) + 1)].id)}
          disabled={questions.findIndex(q => q.id === currentQuestion) === questions.length - 1}
          className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          Next →
        </button>
      </div>

      {/* Quick Navigation */}
      <div className="bg-slate-50 rounded-xl p-4 dark:bg-slate-800/50">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Essay Questions</p>
        <div className="flex gap-2">
          {questions.map((question, index) => {
            const isCurrent = question.id === currentQuestion;
            const answer = answers.find(a => a.questionId === question.id);
            const hasText = answer && answer.text.trim().length > 0;

            return (
              <button
                key={question.id}
                onClick={() => navigateToQuestion(question.id)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-bold transition-all
                  ${isCurrent
                    ? "bg-indigo-500 text-white ring-2 ring-indigo-300"
                    : hasText
                      ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300"
                      : "bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-600"
                  }
                `}
              >
                Essay {index + 1}
                {hasText && !isCurrent && " ✓"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Writing Tips */}
      {!showReview && (
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400">
          <h4 className="font-bold mb-2">💡 Writing Tips:</h4>
          <ul className="space-y-1 text-xs">
            <li>• Structure your answer with a clear introduction, body, and conclusion</li>
            <li>• Reference specific concepts from the provided materials</li>
            <li>• Allocate time based on the suggested minutes for this question</li>
            <li>• Review the rubric criteria to ensure you address all requirements</li>
            <li>• Use academic language and provide specific examples where possible</li>
          </ul>
        </div>
      )}
    </div>
  );
}