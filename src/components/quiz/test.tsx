"use client";

import type { QuizQuestion } from "@/lib/gemini";
import { ClayCard } from "@/components/ui/clay-card";

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
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-800">
        <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
          📝 Quiz Test 
          <span className="text-sm font-normal text-indigo-600 dark:text-indigo-300 bg-white dark:bg-indigo-900/50 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
            {questions.length} questions
          </span>
        </h3>
        <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
          Answered: {Object.keys(userAnswers).length}/{questions.length}
        </div>
      </div>

      <div className="space-y-6">
        {questions.map((question, index) => (
          <ClayCard
            key={index}
            className="border-2 border-slate-100 dark:border-slate-700 !bg-white dark:!bg-slate-800"
          >
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-10 h-10 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm rotate-3">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-6 leading-relaxed">
                  {question.question}
                </p>
                <div className="grid gap-3">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = userAnswers[index] === option;
                    return (
                      <button
                        key={optionIndex}
                        onClick={() => onAnswerChange(index, option)}
                        className={`
                          group relative flex items-center p-4 rounded-xl text-left transition-all duration-200
                          ${isSelected
                            ? "clay-button !bg-indigo-600 !text-white transform scale-[1.02]"
                            : "bg-slate-50 border-2 border-slate-200 hover:border-indigo-300 hover:bg-white text-slate-700 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500"
                          }
                        `}
                      >
                        <div className={`
                          mr-4 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all
                          ${isSelected
                            ? "border-white bg-white/20"
                            : "border-slate-300 group-hover:border-indigo-400 dark:border-slate-500"
                          }
                        `}>
                          {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
                        </div>
                        <span className="font-semibold">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </ClayCard>
        ))}
      </div>

      <div className="sticky bottom-6 flex justify-end">
        <div className="p-2 backdrop-blur-md bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-white/50 shadow-lg">
          <button
            onClick={onSubmit}
            disabled={!allAnswered || isSubmitting}
            className={`
              clay-button px-8 py-4 text-lg font-bold transition-all
              ${allAnswered && !isSubmitting
                ? "!bg-green-500 hover:!bg-green-400 !text-white transform hover:-translate-y-1"
                : "!bg-slate-200 !text-slate-400 cursor-not-allowed shadow-none active:shadow-none translate-y-1"
              }
            `}
          >
            {isSubmitting ? "🚀 Submitting..." : "✨ Submit Quiz"}
          </button>
        </div>
      </div>

      {!allAnswered && (
        <p className="text-center font-bold text-amber-500 dark:text-amber-400 animate-pulse">
          ⚡ Please answer all questions before submitting!
        </p>
      )}
    </div>
  );
}