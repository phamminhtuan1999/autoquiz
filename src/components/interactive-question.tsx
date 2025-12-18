"use client";

import { useState, useRef, useEffect } from "react";
import type { QuizQuestion } from "@/lib/gemini";
import { recordAnswer } from "@/actions/record-answer";

export function InteractiveQuestion({ 
  question, 
  index, 
  quizId 
}: { 
  question: QuizQuestion; 
  index: number; 
  quizId: string;
}) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const explanationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAnswered && explanationRef.current) {
      explanationRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hasAnswered]);

  const handleOptionSelect = async (optionIndex: number) => {
    if (hasAnswered || isSubmitting) return;

    setSelectedOption(optionIndex);
    setIsSubmitting(true);
    
    // Most quizzes use index-based string answer "1", "2", etc. or full text.
    // Let's check both for robustness.
    const normalizedAnswer = question.answer.toLowerCase();
    const isActuallyCorrect = 
      (optionIndex + 1).toString() === normalizedAnswer || 
      question.options[optionIndex].toLowerCase() === normalizedAnswer ||
      `option ${optionIndex + 1}` === normalizedAnswer;

    await recordAnswer(quizId, index, isActuallyCorrect);
    
    setHasAnswered(true);
    setIsSubmitting(false);
  };

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-slate-800 dark:border-slate-700">
      <p className="text-lg font-bold text-slate-900 mb-4 dark:text-slate-100">
        {index + 1}. {question.question}
      </p>
      
      <div className="grid gap-3">
        {question.options.map((option, optionIndex) => {
          const isSelected = selectedOption === optionIndex;
          const isCorrect = 
            (optionIndex + 1).toString() === question.answer || 
            question.options[optionIndex] === question.answer;
          
          let buttonClass = "w-full text-left p-4 rounded-lg border-2 transition-all duration-200 flex items-center justify-between ";
          
          if (!hasAnswered) {
            buttonClass += isSelected 
              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500" 
              : "border-slate-100 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:hover:border-slate-600";
          } else {
            if (isCorrect) {
              buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-900 font-medium dark:bg-emerald-900/30 dark:text-emerald-300";
            } else if (isSelected) {
              buttonClass += "border-red-500 bg-red-50 text-red-900 dark:bg-red-900/30 dark:text-red-300";
            } else {
              buttonClass += "border-slate-100 bg-slate-50 opacity-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400";
            }
          }

          return (
            <button
              key={optionIndex}
              onClick={() => handleOptionSelect(optionIndex)}
              disabled={hasAnswered || isSubmitting}
              className={buttonClass}
            >
              <span className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                }`}>
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span className="dark:text-slate-200">{option}</span>
              </span>
              {hasAnswered && isCorrect && (
                <span className="text-emerald-600 font-bold dark:text-emerald-400">✓</span>
              )}
              {hasAnswered && isSelected && !isCorrect && (
                <span className="text-red-600 font-bold dark:text-red-400">✗</span>
              )}
            </button>
          );
        })}
      </div>

      {hasAnswered && (
        <div ref={explanationRef} className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 focus:scroll-mt-4 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
              selectedOption !== null && 
              ((selectedOption + 1).toString() === question.answer || question.options[selectedOption] === question.answer)
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
            }`}>
              {selectedOption !== null && 
               ((selectedOption + 1).toString() === question.answer || question.options[selectedOption] === question.answer)
                ? "Correct" : "Incorrect"}
            </span>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">EXPLANATION</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed italic dark:text-slate-300">
            {question.explanation || "No explanation provided."}
          </p>
        </div>
      )}
    </li>
  );
}
