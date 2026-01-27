"use client";

import { useState, useCallback } from "react";
import type { MCQQuestion } from "@/types/mock-exam";

interface MCQSectionProps {
  questions: MCQQuestion[];
  answers: Record<number, string>;
  onAnswerChange: (questionId: number, answer: string) => void;
  currentQuestion: number;
  onQuestionChange: (questionId: number) => void;
  showReview?: boolean;
}

export function MCQSection({
  questions,
  answers,
  onAnswerChange,
  currentQuestion,
  onQuestionChange,
  showReview = false,
}: MCQSectionProps) {
  const currentQuestionData = questions.find(q => q.id === currentQuestion);
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());

  const handleMarkForReview = useCallback((questionId: number) => {
    setMarkedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  }, []);

  const getOptionLabel = (index: number): string => {
    return String.fromCharCode(65 + index); // A, B, C, D
  };

  const getAnsweredCount = (): number => {
    return questions.filter(q => answers[q.id]).length;
  };

  const navigateToQuestion = useCallback((questionId: number) => {
    onQuestionChange(questionId);
  }, [onQuestionChange]);

  const navigatePrevious = useCallback(() => {
    const currentIndex = questions.findIndex(q => q.id === currentQuestion);
    if (currentIndex > 0) {
      onQuestionChange(questions[currentIndex - 1].id);
    }
  }, [currentQuestion, questions, onQuestionChange]);

  const navigateNext = useCallback(() => {
    const currentIndex = questions.findIndex(q => q.id === currentQuestion);
    if (currentIndex < questions.length - 1) {
      onQuestionChange(questions[currentIndex + 1].id);
    }
  }, [currentQuestion, questions, onQuestionChange]);

  if (!currentQuestionData) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Question not found</p>
      </div>
    );
  }

  const userAnswer = answers[currentQuestion];
  const isCorrect = userAnswer === currentQuestionData.correctAnswer;
  const isAnswered = !!userAnswer;

  return (
    <div className="space-y-6">
      {/* Question Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
            MCQ Question {questions.findIndex(q => q.id === currentQuestion) + 1} of {questions.length}
          </span>
          <span className={`
            text-xs px-2 py-1 rounded-full font-medium
            ${currentQuestionData.difficulty === "easy" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300" :
              currentQuestionData.difficulty === "hard" ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300" :
              "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"}
          `}>
            {currentQuestionData.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {markedQuestions.has(currentQuestion) && (
            <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
              ⭐ Marked
            </span>
          )}
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {getAnsweredCount()}/{questions.length} answered
          </span>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700">
        <div className="mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
            Topic: {currentQuestionData.topic} • Source: {currentQuestionData.sourceDocument}
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {currentQuestionData.question}
          </h2>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestionData.options.map((option, index) => {
            const optionLabel = getOptionLabel(index);
            const isSelected = userAnswer === `${optionLabel}) ${option}`;
            const isCorrectOption = `${optionLabel}) ${option}` === currentQuestionData.correctAnswer;
            const showCorrectness = showReview && userAnswer;

            return (
              <button
                key={index}
                onClick={() => !showReview && onAnswerChange(currentQuestion, `${optionLabel}) ${option}`)}
                disabled={showReview}
                className={`
                  w-full text-left p-4 rounded-xl border-2 transition-all
                  ${showReview
                    ? isCorrectOption
                      ? "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700"
                      : isSelected && !isCorrectOption
                        ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                        : "bg-slate-50 border-slate-200 dark:bg-slate-700/50 dark:border-slate-600"
                    : isSelected
                      ? "bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700"
                      : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                  }
                  ${!showReview && "cursor-pointer hover:shadow-md"}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold
                    ${showReview
                      ? isCorrectOption
                        ? "bg-green-500 text-white border-green-500"
                        : isSelected && !isCorrectOption
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-400"
                      : isSelected
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300"
                    }
                  `}>
                    {showReview
                      ? isCorrectOption ? "✓" : isSelected && !isCorrectOption ? "✗" : optionLabel
                      : optionLabel
                    }
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {option}
                    </p>
                    {showReview && isCorrectOption && currentQuestionData.explanation && (
                      <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                        ✓ {currentQuestionData.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Mark for Review */}
        {!showReview && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => handleMarkForReview(currentQuestion)}
              className={`
                text-sm px-3 py-1.5 rounded-lg transition-colors
                ${markedQuestions.has(currentQuestion)
                  ? "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
                }
              `}
            >
              {markedQuestions.has(currentQuestion) ? "⭐ Unmark" : "⭐ Mark for Review"}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={navigatePrevious}
          disabled={questions.findIndex(q => q.id === currentQuestion) === 0}
          className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-2">
          {!showReview && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {isAnswered ? "✓ Answered" : "○ Not answered"}
            </span>
          )}
          {showReview && (
            <span className={`
              text-sm font-medium px-3 py-1 rounded-lg
              ${isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300" :
                isAnswered ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300" :
                "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"}
            `}>
              {isCorrect ? "✓ Correct" : isAnswered ? "✗ Incorrect" : "○ Not answered"}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={navigateNext}
          disabled={questions.findIndex(q => q.id === currentQuestion) === questions.length - 1}
          className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          Next →
        </button>
      </div>

      {/* Question Grid Navigator */}
      <div className="bg-slate-50 rounded-xl p-4 dark:bg-slate-800/50">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Quick Navigation</p>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {questions.map((question) => {
            const isCurrent = question.id === currentQuestion;
            const isAnswered = !!answers[question.id];
            const isMarked = markedQuestions.has(question.id);

            return (
              <button
                key={question.id}
                onClick={() => navigateToQuestion(question.id)}
                className={`
                  w-8 h-8 rounded-lg text-xs font-bold transition-all
                  ${isCurrent
                    ? "bg-indigo-500 text-white ring-2 ring-indigo-300"
                    : isAnswered
                      ? isMarked
                        ? "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-300"
                        : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300"
                      : isMarked
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-300"
                        : "bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-600"
                  }
                `}
              >
                {questions.findIndex(q => q.id === question.id) + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border-2 border-slate-200 rounded dark:bg-slate-700 dark:border-slate-600"></div>
          <span>Not answered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 rounded dark:bg-green-900/20"></div>
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-100 rounded dark:bg-purple-900/20"></div>
          <span>Marked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-indigo-500 rounded"></div>
          <span>Current</span>
        </div>
      </div>
    </div>
  );
}