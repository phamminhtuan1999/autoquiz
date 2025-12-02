"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CramResult, GoldenNugget, BlitzQuestion } from "@/types/cram";

export default function CramDashboard() {
  const router = useRouter();
  const [cramResult, setCramResult] = useState<CramResult | null>(null);
  const [cramTitle, setCramTitle] = useState<string>("Cram Session");
  const [activeView, setActiveView] = useState<"summary" | "flashcards">(
    "summary"
  );
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const [isPrintMode, setIsPrintMode] = useState<boolean>(false);

  useEffect(() => {
    // Check for print mode
    const checkPrintMode = () => {
      if (typeof window !== "undefined") {
        setIsPrintMode(window.matchMedia("print").matches);
      }
    };

    // Load the cram result from sessionStorage
    const storedResult = sessionStorage.getItem("cramResult");
    const storedTitle = sessionStorage.getItem("cramTitle");

    if (storedResult) {
      try {
        const parsed = JSON.parse(storedResult) as CramResult;
        setCramResult(parsed);
        if (storedTitle) {
          setCramTitle(storedTitle);
        }
      } catch (error) {
        console.error("Failed to parse cram result:", error);
        router.push("/dashboard");
      }
    } else {
      // No cram result found, redirect to dashboard
      router.push("/dashboard");
    }

    // Set up print mode detection
    if (typeof window !== "undefined") {
      checkPrintMode();
      const mediaQuery = window.matchMedia("print");
      const handleChange = () => setIsPrintMode(mediaQuery.matches);
      const handleBeforePrint = () => setIsPrintMode(true);
      const handleAfterPrint = () => setIsPrintMode(false);

      // Listen for print events
      mediaQuery.addEventListener("change", handleChange);
      window.addEventListener("beforeprint", handleBeforePrint);
      window.addEventListener("afterprint", handleAfterPrint);

      return () => {
        mediaQuery.removeEventListener("change", handleChange);
        window.removeEventListener("beforeprint", handleBeforePrint);
        window.removeEventListener("afterprint", handleAfterPrint);
      };
    }
  }, [router]);

  const toggleCard = (index: number) => {
    setRevealedCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const revealAll = () => {
    if (!cramResult) return;
    const allIndices = cramResult.blitz_questions.map((_, i) => i);
    setRevealedCards(new Set(allIndices));
  };

  const hideAll = () => {
    setRevealedCards(new Set());
  };

  const handlePrint = () => {
    window.print();
  };

  if (!cramResult) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-600">Loading cram session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>🚨</span>
                Cram Mode: {cramTitle}
              </h1>
              <p className="text-orange-100 text-sm mt-1">
                High-yield facts + rapid-fire flashcards for your exam
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
              >
                🖨️ Print
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="lg:hidden border-b border-slate-200 bg-white rounded-lg p-1">
          <nav className="flex gap-2">
            <button
              onClick={() => setActiveView("summary")}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                activeView === "summary"
                  ? "bg-orange-500 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              📝 Golden Nuggets ({cramResult.summary.length})
            </button>
            <button
              onClick={() => setActiveView("flashcards")}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                activeView === "flashcards"
                  ? "bg-orange-500 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              ⚡ Blitz Cards ({cramResult.blitz_questions.length})
            </button>
          </nav>
        </div>

        {/* Desktop Split View / Mobile Single View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Panel: Golden Nuggets (The Cheat Sheet) */}
          <div
            className={`${
              activeView === "summary" ? "block" : "hidden lg:block"
            }`}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 print:shadow-none">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span>📝</span>
                  Golden Nuggets
                </h2>
                <span className="text-sm text-slate-500 font-medium">
                  Top {cramResult.summary.length} Facts
                </span>
              </div>

              <div className="space-y-3">
                {cramResult.summary.map((nugget: GoldenNugget, index) => (
                  <div
                    key={index}
                    className="border border-orange-200 bg-orange-50/50 rounded-lg p-4 print:break-inside-avoid"
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

              <div className="border-t border-slate-200 pt-4 print:hidden">
                <button
                  onClick={handlePrint}
                  className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                >
                  🖨️ Print This Cheat Sheet
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Blitz Questions (Flashcards) */}
          <div
            className={`${
              activeView === "flashcards" ? "block" : "hidden lg:block"
            }`}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4 print:shadow-none">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span>⚡</span>
                  Blitz Flashcards
                </h2>
                <span className="text-sm text-slate-500 font-medium">
                  {cramResult.blitz_questions.length} Questions
                </span>
              </div>

              <div className="flex gap-2 print:hidden">
                <button
                  onClick={revealAll}
                  className="flex-1 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium transition"
                >
                  Reveal All
                </button>
                <button
                  onClick={hideAll}
                  className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition"
                >
                  Hide All
                </button>
              </div>

              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto print:max-h-none print:overflow-visible">
                {cramResult.blitz_questions.map(
                  (card: BlitzQuestion, index) => (
                    <div
                      key={index}
                      onClick={() => toggleCard(index)}
                      className="cursor-pointer border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all print:break-inside-avoid print:cursor-default"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm mb-2">
                            {card.question}
                          </p>
                          <div
                            className={`mt-2 pt-2 border-t border-slate-200 transition-all ${
                              revealedCards.has(index) || isPrintMode
                                ? "block"
                                : "hidden"
                            }`}
                          >
                            <p className="text-sm text-slate-700 bg-slate-50 rounded p-2">
                              <strong className="text-slate-900">
                                Answer:
                              </strong>{" "}
                              {card.answer}
                            </p>
                          </div>
                          {!revealedCards.has(index) && (
                            <p className="text-xs text-slate-500 mt-2 print:hidden">
                              Click to reveal answer
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:break-inside-avoid {
            break-inside: avoid;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:max-h-none {
            max-height: none !important;
          }
          .print\\:overflow-visible {
            overflow: visible !important;
          }
          .print\\:cursor-default {
            cursor: default !important;
          }
        }
      `}</style>
    </div>
  );
}
