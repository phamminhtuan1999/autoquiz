"use client";

import type { QuizQuestion } from "@/lib/gemini";

type QuizTestProps = {
  questions: QuizQuestion[];
  userAnswers: Record<number, string>;
  onAnswerChange: (questionIndex: number, answer: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
};

export function QuizTest({ 
  questions, 
  userAnswers, 
  onAnswerChange, 
  onSubmit, 
  isSubmitting 
}: QuizTestProps) {
  const allAnswered = questions.every((_, index) => userAnswers[index]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">
          Quiz Test ({questions.length} questions)
        </h3>
        <div className="text-sm text-slate-600">
          Answered: {Object.keys(userAnswers).length}/{questions.length}
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div
            key={index}
            className="rounded-lg border border-slate-200 p-4 bg-white"
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-slate-900 mb-3">
                  {question.question}
                </p>
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={optionIndex}
                      className={`
                        flex items-center p-3 rounded-lg border cursor-pointer transition-all
                        ${userAnswers[index] === option
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={option}
                        checked={userAnswers[index] === option}
                        onChange={() => onAnswerChange(index, option)}
                        className="mr-3 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSubmit}
          disabled={!allAnswered || isSubmitting}
          className={`
            px-6 py-3 rounded-lg font-medium transition-all
            ${allAnswered && !isSubmitting
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }
          `}
        >
          {isSubmitting ? "Submitting..." : "Submit Quiz"}
        </button>
      </div>

      {!allAnswered && (
        <p className="text-sm text-amber-600 text-center">
          Please answer all questions before submitting.
        </p>
      )}
    </div>
  );
}