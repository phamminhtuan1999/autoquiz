"use client";

import { useState, useTransition } from "react";
import { generateCram } from "@/actions/generate-cram";
import { extractTextFromPdf } from "@/utils/pdf";
import { useRouter } from "next/navigation";

interface CramButtonProps {
  file: File | null;
  disabled?: boolean;
}

export function CramButton({ file, disabled }: CramButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>("");

  const handleCramMode = () => {
    if (!file) {
      setError("Upload a PDF first");
      return;
    }

    startTransition(async () => {
      setStatus("Extracting PDF text...");
      setProgress(10);
      setError(null);

      try {
        const documentText = await extractTextFromPdf(file);
        setProgress(30);
        setStatus("Generating Cram Session... (This costs 3 credits)");

        const cramResult = await generateCram({
          documentText,
          title: file.name.replace(/\.pdf$/i, ""),
          filename: file.name,
        });

        setProgress(100);
        setStatus("Cram Session ready!");

        // Store the result in sessionStorage for the dashboard to use
        sessionStorage.setItem("cramResult", JSON.stringify(cramResult));
        sessionStorage.setItem("cramTitle", file.name.replace(/\.pdf$/i, ""));

        // Navigate to the cram dashboard
        router.push("/dashboard/cram");
      } catch (err) {
        setError((err as Error).message);
        setStatus("");
        setProgress(0);
      }
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCramMode}
        disabled={isPending || disabled || !file}
        className="inline-flex w-full items-center justify-center rounded-md bg-gradient-to-r from-orange-500 to-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="mr-2">🚨</span>
        {isPending ? "Generating Cram Session..." : "CRAM MODE (3 Credits)"}
      </button>

      {progress > 0 && progress < 100 && (
        <div className="w-full">
          <div className="flex justify-between text-sm text-slate-600 mb-1">
            <span>{status}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-orange-500 to-red-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status && progress === 0 && (
        <p className="text-sm font-medium text-slate-600">{status}</p>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">{error}</p>
          {error.includes("Insufficient credits") && (
            <p className="text-xs text-red-600 mt-1">
              Cram Mode requires 3 credits. Please purchase more credits to
              continue.
            </p>
          )}
        </div>
      )}

      <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
        <p className="text-xs font-medium text-orange-900">
          ⚡ <strong>Premium Feature:</strong> Exam tomorrow? Get the top 10
          critical facts + 20 rapid-fire flashcards in one click.
        </p>
        <p className="text-xs text-orange-700 mt-1">
          Perfect for last-minute review. Costs 3 credits.
        </p>
      </div>
    </div>
  );
}
