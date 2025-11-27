"use client";

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
    if (percentage >= 90) return { grade: "A", color: "text-green-600" };
    if (percentage >= 80) return { grade: "B", color: "text-blue-600" };
    if (percentage >= 70) return { grade: "C", color: "text-yellow-600" };
    if (percentage >= 60) return { grade: "D", color: "text-orange-600" };
    return { grade: "F", color: "text-red-600" };
  };

  const { grade, color } = getGrade();

  return (
    <div className="space-y-6">
      {/* Score Summary */}
      <div className="text-center p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Quiz Results</h3>
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className={`text-4xl font-bold ${color}`}>{grade}</div>
          <div className="text-left">
            <div className="text-2xl font-semibold text-slate-900">
              {score}/{questions.length}
            </div>
            <div className="text-sm text-slate-600">{percentage}%</div>
          </div>
        </div>
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          passed 
            ? "bg-green-100 text-green-800" 
            : "bg-red-100 text-red-800"
        }`}>
          {passed ? "✓ Passed" : "✗ Failed"}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={onRetakeTest}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Retake Test
        </button>
        <button
          onClick={onBackToPreview}
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
        >
          Back to Preview
        </button>
      </div>

      {/* Detailed Results */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-slate-900">Detailed Results</h4>
        {questions.map((question, index) => {
          const userAnswer = userAnswers[index];
          const isCorrect = userAnswer === question.answer;
          
          return (
            <div
              key={index}
              className={`rounded-lg border p-4 ${
                isCorrect 
                  ? "border-green-200 bg-green-50" 
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isCorrect 
                    ? "bg-green-200 text-green-800" 
                    : "bg-red-200 text-red-800"
                }`}>
                  {isCorrect ? "✓" : "✗"}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-slate-900 mb-2">
                    {index + 1}. {question.question}
                  </p>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-600">Your answer:</span>
                      <span className={isCorrect ? "text-green-700" : "text-red-700"}>
                        {userAnswer || "Not answered"}
                      </span>
                    </div>
                    
                    {!isCorrect && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-600">Correct answer:</span>
                        <span className="text-green-700 font-medium">{question.answer}</span>
                      </div>
                    )}
                    
                    {question.explanation && (
                      <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                        <span className="font-medium text-slate-600">Explanation:</span>
                        <p className="text-slate-700 mt-1">{question.explanation}</p>
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