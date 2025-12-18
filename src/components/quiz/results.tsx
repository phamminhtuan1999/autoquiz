"use client";

import { useRef, useEffect } from "react";
import { ClayCard } from "@/components/ui/clay-card";
import type { QuizQuestion } from "@/lib/gemini";

type QuizResultsProps = {
  questions: QuizQuestion[];
  userAnswers: Record<number, string>;
  onRetakeTest: () => void;
  onBackToPreview: () => void;
};

export function QuizResults({ 
  questions, 
  userAnswers, 
  onRetakeTest, 
  onBackToPreview 
}: QuizResultsProps) {
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to results when component mounts
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((question, index) => {
      if (userAnswers[index] === question.answer) {
        correct++;
      }
    });
    return correct;
  };

  const score = calculateScore();
  const percentage = Math.round((score / questions.length) * 100);
  const passed = percentage >= 70;

  const getGrade = () => {
    if (percentage >= 90) return { grade: "A+", color: "text-green-500", emoji: "🏆" };
    if (percentage >= 80) return { grade: "B", color: "text-blue-500", emoji: "🎉" };
    if (percentage >= 70) return { grade: "C", color: "text-yellow-500", emoji: "👍" };
    if (percentage >= 60) return { grade: "D", color: "text-orange-500", emoji: "😬" };
    return { grade: "F", color: "text-red-500", emoji: "🙈" };
  };

  const { grade, color, emoji } = getGrade();

  return (
    <div ref={resultsRef} className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
      {/* Report Card */}
      <ClayCard className="text-center overflow-hidden relative !p-0">
        <div className={`absolute top-0 left-0 w-full h-32 ${passed ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-red-100 dark:bg-red-900/50'} z-0`} />
        
        <div className="relative z-10 pt-16 px-8 pb-8">
          <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-lg border-4 border-white dark:bg-slate-800 dark:border-slate-700">
            <span className={`text-6xl font-black ${color}`} style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.1)' }}>
              {grade}
            </span>
          </div>

          <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-2">
            {passed ? "Way to go! 🎉" : "Keep trying! 💪"}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
            You scored {score} out of {questions.length} ({percentage}%)
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <button
              onClick={onRetakeTest}
              className="clay-button flex-1 justify-center !bg-indigo-600 !text-white"
            >
              🔄 Retake Quiz
            </button>
            <button
              onClick={onBackToPreview}
              className="clay-button flex-1 justify-center !bg-white !text-slate-600 hover:!bg-slate-50"
            >
              📚 Review Study
            </button>
          </div>
        </div>
      </ClayCard>

      {/* Detailed Results */}
      <div className="space-y-6">
        <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 ml-2">
          Detailed Breakdown
        </h4>
        {questions.map((question, index) => {
          const userAnswer = userAnswers[index];
          const isCorrect = userAnswer === question.answer;
          
          return (
            <div
              key={index}
              className={`
                group relative rounded-2xl border-2 p-6 transition-all duration-300
                ${isCorrect 
                  ? "border-green-200 bg-green-50/50 hover:border-green-300 dark:border-green-900/30 dark:bg-green-900/10" 
                  : "border-red-200 bg-red-50/50 hover:border-red-300 dark:border-red-900/30 dark:bg-red-900/10"
                }
              `}
            >
              <div className="flex items-start gap-4">
                <div className={`
                  flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg shadow-sm rotate-3
                  ${isCorrect 
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }
                `}>
                  {isCorrect ? "✅" : "❌"}
                </div>
                
                <div className="flex-1">
                  <p className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-4">
                    {question.question}
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Your Answer</span>
                      <span className={`px-3 py-1 rounded-lg font-bold text-sm ${isCorrect ? 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                        {userAnswer || "Not answered"}
                      </span>
                    </div>
                    
                    {!isCorrect && (
                      <div className="flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-left-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Correct Answer</span>
                        <span className="px-3 py-1 rounded-lg font-bold text-sm bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {question.answer}
                        </span>
                      </div>
                    )}
                    
                    {question.explanation && (
                      <div className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm border border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        <span className="mb-1 block text-xs font-black uppercase text-indigo-400">Explanation</span>
                        {question.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}