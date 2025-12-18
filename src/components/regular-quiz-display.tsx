"use client";

import type { QuizQuestion } from "@/lib/gemini";
import { InteractiveQuestion } from "@/components/interactive-question";

export function RegularQuizDisplay({ 
  questions, 
  quizId 
}: { 
  questions: QuizQuestion[];
  quizId: string;
}) {
  return (
    <div className="space-y-4">
      <ol className="space-y-8">
        {questions.map((question, index) => (
          <InteractiveQuestion 
            key={index} 
            question={question} 
            index={index} 
            quizId={quizId} 
          />
        ))}
      </ol>
    </div>
  );
}
