"use client";

import type { CramResult, GoldenNugget, BlitzQuestion } from "@/types/cram";

export function CramModeDisplay({ cramResult }: { cramResult: CramResult }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Golden Nuggets */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>📝</span>
            Golden Nuggets
          </h2>
          <span className="text-sm text-slate-500 font-medium">
            {cramResult.summary.length} Facts
          </span>
        </div>
        <div className="space-y-3">
          {cramResult.summary.map((nugget: GoldenNugget, index) => (
            <div
              key={index}
              className="border border-orange-200 bg-orange-50/50 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">
                    {nugget.topic}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {nugget.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blitz Questions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>⚡</span>
            Blitz Flashcards
          </h2>
          <span className="text-sm text-slate-500 font-medium">
            {cramResult.blitz_questions.length} Questions
          </span>
        </div>
        <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
          {cramResult.blitz_questions.map((card: BlitzQuestion, index) => (
            <div key={index} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm mb-2">
                    {card.question}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <p className="text-sm text-slate-700 bg-slate-50 rounded p-2">
                      <strong className="text-slate-900">Answer:</strong>{" "}
                      {card.answer}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
