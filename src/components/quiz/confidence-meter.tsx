"use client";

import { ProgressBar, ProgressBarFill, ProgressBarTrack } from "@heroui/react";

function confidenceColor(value: number): "success" | "warning" | "danger" {
  if (value >= 85) return "success";
  if (value >= 60) return "warning";
  return "danger";
}

interface ConfidenceMeterProps {
  value: number;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceMeter({ value, showLabel = true, className }: ConfidenceMeterProps) {
  const color = confidenceColor(value);
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <ProgressBar
        value={value}
        aria-label={`Confidence: ${value}%`}
        color={color}
        size="sm"
        className="flex-1"
      >
        <ProgressBarTrack>
          <ProgressBarFill />
        </ProgressBarTrack>
      </ProgressBar>
      {showLabel && (
        <span className="font-mono text-xs text-[var(--fg-muted)] w-8 text-right tabular-nums">
          {value}%
        </span>
      )}
    </div>
  );
}
