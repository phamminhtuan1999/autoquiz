"use client";

import { useState, useCallback } from "react";
import type { ChangeEvent } from "react";

interface SelectedDocument {
  file: File;
  text?: string;
  processed: boolean;
  error?: string;
}

interface PdfMultiSelectorProps {
  onDocumentsChange: (documents: { filename: string; text: string }[]) => void;
  disabled?: boolean;
}

export function PdfMultiSelector({ onDocumentsChange, disabled = false }: PdfMultiSelectorProps) {
  const [selectedDocs, setSelectedDocs] = useState<SelectedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    // Check limit
    if (selectedDocs.length + files.length > 5) {
      alert("Maximum 5 PDFs can be selected for a mock exam.");
      event.target.value = ""; // Clear input
      return;
    }

    // Check file types
    const invalidFiles = files.filter(f => f.type !== "application/pdf");
    if (invalidFiles.length > 0) {
      alert(`Only PDF files are supported. Invalid files: ${invalidFiles.map(f => f.name).join(", ")}`);
      event.target.value = ""; // Clear input
      return;
    }

    setIsProcessing(true);

    try {
      const newDocs: SelectedDocument[] = files.map(file => ({
        file,
        processed: false,
      }));

      const updatedDocs = [...selectedDocs, ...newDocs];
      setSelectedDocs(updatedDocs);

      // Process each file to extract text
      const processedTexts: { filename: string; text: string }[] = [];

      for (let i = 0; i < newDocs.length; i++) {
        try {
          const { extractTextFromPdf } = await import("@/utils/pdf");
          const text = await extractTextFromPdf(newDocs[i].file);

          // Update the specific document with text
          newDocs[i].text = text;
          newDocs[i].processed = true;

          processedTexts.push({
            filename: newDocs[i].file.name,
            text,
          });

          // Trigger re-render to show processed status
          setSelectedDocs([...updatedDocs]);
        } catch (error) {
          newDocs[i].error = (error as Error).message;
          newDocs[i].processed = true;
          setSelectedDocs([...updatedDocs]);
        }
      }

      // Combine with previously processed documents
      const previouslyProcessed = selectedDocs
        .filter(doc => doc.processed && doc.text)
        .map(doc => ({ filename: doc.file.name, text: doc.text! }));

      onDocumentsChange([...previouslyProcessed, ...processedTexts]);
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessing(false);
      event.target.value = ""; // Clear input
    }
  }, [selectedDocs, onDocumentsChange]);

  const handleRemoveDocument = useCallback((index: number) => {
    const updatedDocs = selectedDocs.filter((_, i) => i !== index);
    setSelectedDocs(updatedDocs);

    // Update documents array for parent
    const processedDocs = updatedDocs
      .filter(doc => doc.processed && doc.text)
      .map(doc => ({ filename: doc.file.name, text: doc.text! }));

    onDocumentsChange(processedDocs);
  }, [selectedDocs, onDocumentsChange]);

  const canAddMore = selectedDocs.length < 5;
  const allProcessed = selectedDocs.length > 0 && selectedDocs.every(doc => doc.processed);
  const hasErrors = selectedDocs.some(doc => doc.error);

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div className={`relative group ${!canAddMore || disabled ? "opacity-50" : ""}`}>
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileSelect}
          disabled={!canAddMore || disabled || isProcessing}
          className="absolute inset-0 z-10 w-full h-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div className={`
          flex flex-col items-center justify-center rounded-2xl border-3 border-dashed px-6 py-8 transition-all duration-300
          ${canAddMore && !disabled && !isProcessing
            ? "border-indigo-400 bg-indigo-50/50 hover:border-indigo-500 hover:bg-indigo-100/50 dark:bg-indigo-900/20 dark:hover:border-indigo-300"
            : "border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/50"
          }
        `}>
          <div className={`mb-3 text-4xl ${isProcessing ? "animate-spin" : ""}`}>
            {isProcessing ? "⏳" : canAddMore ? "📥" : "✓"}
          </div>
          <p className="font-bold text-slate-700 dark:text-slate-300 text-center">
            {isProcessing ? "Processing PDFs..." :
             !canAddMore ? "Maximum PDFs selected" :
             disabled ? "PDF selection disabled" :
             "Drop PDFs here or click to browse"}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 text-center">
            {isProcessing ? "This may take a moment..." :
             !canAddMore ? "Remove a PDF to add another" :
             `${selectedDocs.length}/5 PDFs selected • Max 15MB each`}
          </p>
        </div>
      </div>

      {/* Selected Documents List */}
      {selectedDocs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Selected Documents ({selectedDocs.length}/5)
          </h3>

          <div className="grid gap-3">
            {selectedDocs.map((doc, index) => (
              <div
                key={index}
                className={`
                  flex items-center gap-3 rounded-xl border-2 p-4 transition-all
                  ${doc.error
                    ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20"
                    : doc.processed
                      ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20"
                      : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
                  }
                `}
              >
                <div className="flex-shrink-0">
                  {doc.error ? (
                    <div className="text-2xl">❌</div>
                  ) : doc.processed ? (
                    <div className="text-2xl">✅</div>
                  ) : (
                    <div className="text-2xl animate-spin">⏳</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {doc.file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {doc.error
                      ? `Error: ${doc.error}`
                      : doc.processed
                        ? `${Math.round(doc.text!.length / 1000)}K characters processed`
                        : "Processing..."
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveDocument(index)}
                  disabled={disabled || isProcessing}
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  aria-label="Remove document"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Status Messages */}
          {hasErrors && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
              ⚠️ Some PDFs couldn&apos;t be processed. Remove them or try different files.
            </div>
          )}

          {allProcessed && !hasErrors && selectedDocs.length >= 2 && (
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
              ✅ All PDFs processed successfully! Ready to generate mock exam.
            </div>
          )}

          {allProcessed && !hasErrors && selectedDocs.length === 1 && (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
              ℹ️ Tip: Adding more PDFs creates more comprehensive exams with diverse content.
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {selectedDocs.length === 0 && (
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400">
          <h4 className="font-bold mb-2">📚 Mock Exam Guidelines</h4>
          <ul className="space-y-1 text-xs">
            <li>• Select 1-5 lecture PDFs to combine into a comprehensive exam</li>
            <li>• Each PDF should contain course material you want to be tested on</li>
            <li>• The AI will create 30 MCQs + 2 essays across all materials</li>
            <li>• Cost: 5 credits for the complete mock exam</li>
          </ul>
        </div>
      )}
    </div>
  );
}