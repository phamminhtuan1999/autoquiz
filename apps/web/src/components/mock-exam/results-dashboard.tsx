"use client";

import type { MockExamResult } from "@/types/mock-exam";

interface ResultsDashboardProps {
  results: MockExamResult;
  examTitle: string;
  sourceDocuments: string[];
  timeLimitMinutes: number;
  onRetake?: () => void;
  onDownloadReport?: () => void;
  onViewDetailedFeedback?: () => void;
}

export function ResultsDashboard({
  results,
  examTitle,
  sourceDocuments,
  timeLimitMinutes,
  onRetake,
  onDownloadReport,
  onViewDetailedFeedback,
}: ResultsDashboardProps) {
  const {
    mcqScore,
    mcqTotal,
    essayScores,
    totalPercentage,
    grade,
    feedback,
    timeSpentMinutes,
    topicsStrengths,
    topicsWeaknesses,
  } = results;

  // Calculate essay scores
  const essayTotal = essayScores.reduce((sum, s) => sum + s.maxScore, 0);
  const essayEarned = essayScores.reduce((sum, s) => sum + s.totalScore, 0);
  const essayPercentage = essayTotal > 0 ? Math.round((essayEarned / essayTotal) * 100) : 0;

  // Calculate MCQ percentage
  const mcqPercentage = Math.round((mcqScore / mcqTotal) * 100);

  // Time analysis
  const timeUsedPercentage = Math.round((timeSpentMinutes / timeLimitMinutes) * 100);
  const timeEfficiency = timeSpentMinutes <= timeLimitMinutes ? "Good" : "Over time limit";

  // Grade color
  const getGradeColor = (grade: string): string => {
    if (grade.startsWith('A')) return "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20";
    if (grade.startsWith('B')) return "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20";
    if (grade.startsWith('C')) return "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20";
    if (grade.startsWith('D')) return "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20";
    return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Exam Results
        </h1>
        <p className="text-slate-600 dark:text-slate-400">{examTitle}</p>
      </div>

      {/* Overall Score Card */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200 p-8 dark:from-indigo-900/20 dark:to-purple-900/20 dark:border-indigo-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          {/* Grade */}
          <div>
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full text-4xl font-bold ${getGradeColor(grade)}`}>
              {grade}
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Final Grade</p>
          </div>

          {/* Percentage */}
          <div>
            <div className="text-4xl font-bold text-slate-900 dark:text-slate-100">
              {totalPercentage}%
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Overall Score</p>
          </div>

          {/* Time */}
          <div>
            <div className="text-4xl font-bold text-slate-900 dark:text-slate-100">
              {timeSpentMinutes}m
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Time Used ({timeEfficiency})</p>
          </div>
        </div>
      </div>

      {/* Section Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MCQ Results */}
        <div className="bg-white rounded-xl border-2 border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Multiple Choice
          </h2>
          <div className="space-y-4">
            {/* Score */}
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {mcqScore}/{mcqTotal}
              </span>
              <span className="text-lg font-medium text-green-600 dark:text-green-400">
                {mcqPercentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${mcqPercentage}%` }}
              />
            </div>

            {/* Topics Analysis */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Topic Performance</h3>
              {topicsStrengths.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">✅ Strengths:</p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400">
                    {topicsStrengths.map((topic, index) => (
                      <li key={index} className="ml-2">• {topic}</li>
                    ))}
                  </ul>
                </div>
              )}
              {topicsWeaknesses.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">⚠️ Areas to Review:</p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400">
                    {topicsWeaknesses.map((topic, index) => (
                      <li key={index} className="ml-2">• {topic}</li>
                    ))}
                  </ul>
                </div>
              )}
              {topicsStrengths.length === 0 && topicsWeaknesses.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">No specific topic analysis available</p>
              )}
            </div>
          </div>
        </div>

        {/* Essay Results */}
        <div className="bg-white rounded-xl border-2 border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Essays
          </h2>
          <div className="space-y-4">
            {/* Score */}
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {essayEarned}/{essayTotal}
              </span>
              <span className="text-lg font-medium text-blue-600 dark:text-blue-400">
                {essayPercentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${essayPercentage}%` }}
              />
            </div>

            {/* Individual Essay Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Essay Breakdown</h3>
              {essayScores.map((essay, index) => (
                <div key={essay.questionId} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Essay {index + 1}</span>
                    <span>{Math.round((essay.totalScore / essay.maxScore) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-700">
                    <div
                      className="h-full bg-blue-400 transition-all duration-500"
                      style={{ width: `${(essay.totalScore / essay.maxScore) * 100}%` }}
                    />
                  </div>
                  {essay.overallFeedback && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                      &quot;{essay.overallFeedback}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Feedback */}
      {feedback && (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            🤖 AI-Powered Feedback
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            {feedback.strengths && feedback.strengths.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-green-600 dark:text-green-400">💪 Strengths</h3>
                <ul className="space-y-1">
                  {feedback.strengths.map((strength, index) => (
                    <li key={index} className="text-sm text-slate-600 dark:text-slate-400">
                      • {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Areas for Improvement */}
            {feedback.areasForImprovement && feedback.areasForImprovement.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">🎯 Areas for Improvement</h3>
                <ul className="space-y-1">
                  {feedback.areasForImprovement.map((area, index) => (
                    <li key={index} className="text-sm text-slate-600 dark:text-slate-400">
                      • {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Study Recommendations */}
            {feedback.studyRecommendations && feedback.studyRecommendations.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">📚 Study Recommendations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {feedback.studyRecommendations.map((recommendation, index) => (
                    <div key={index} className="text-sm text-slate-600 dark:text-slate-400">
                      • {recommendation}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            {feedback.nextSteps && feedback.nextSteps.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <h3 className="text-sm font-bold text-purple-600 dark:text-purple-400">🚀 Next Steps</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {feedback.nextSteps.map((step, index) => (
                    <div key={index} className="text-sm text-slate-600 dark:text-slate-400">
                      {index + 1}. {step}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Analytics */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
          📊 Performance Analytics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Documents Covered */}
          <div className="text-center p-4 bg-slate-50 rounded-lg dark:bg-slate-700/50">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {sourceDocuments.length}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Documents Covered</p>
          </div>

          {/* Time Efficiency */}
          <div className="text-center p-4 bg-slate-50 rounded-lg dark:bg-slate-700/50">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {timeUsedPercentage}%
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Time Utilized</p>
          </div>

          {/* MCQ Accuracy */}
          <div className="text-center p-4 bg-slate-50 rounded-lg dark:bg-slate-700/50">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {mcqPercentage}%
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">MCQ Accuracy</p>
          </div>

          {/* Essay Performance */}
          <div className="text-center p-4 bg-slate-50 rounded-lg dark:bg-slate-700/50">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {essayPercentage}%
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Essay Score</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {onRetake && (
          <button
            onClick={onRetake}
            className="px-6 py-3 rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
          >
            🔄 Retake Exam
          </button>
        )}
        {onDownloadReport && (
          <button
            onClick={onDownloadReport}
            className="px-6 py-3 rounded-lg bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            📥 Download Report
          </button>
        )}
        {onViewDetailedFeedback && (
          <button
            onClick={onViewDetailedFeedback}
            className="px-6 py-3 rounded-lg bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            📝 Detailed Feedback
          </button>
        )}
      </div>
    </div>
  );
}
