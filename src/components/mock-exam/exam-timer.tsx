"use client";

import { useState, useEffect, useCallback } from "react";
import type { TimerWarning } from "@/types/mock-exam";

interface ExamTimerProps {
  totalMinutes: number;
  onTimeExpired: () => void;
  onWarning: (level: TimerWarning, remainingSeconds: number) => void;
  isActive?: boolean;
  className?: string;
}

export function ExamTimer({
  totalMinutes,
  onTimeExpired,
  onWarning,
  isActive = true,
  className = ""
}: ExamTimerProps) {
  const totalSeconds = totalMinutes * 60;
  const [timeRemaining, setTimeRemaining] = useState<number>(totalSeconds);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  // Calculate warning levels
  const getWarningLevel = useCallback((remaining: number): TimerWarning => {
    const percentage = (remaining / totalSeconds) * 100;

    if (remaining <= 0) return "expired";
    if (remaining <= 300) return "critical";  // 5 minutes
    if (remaining <= 600) return "warning";   // 10 minutes
    return "normal";
  }, [totalSeconds]);

  // Format time display
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get timer color based on warning level
  const getTimerColor = useCallback((level: TimerWarning): string => {
    switch (level) {
      case "expired":
        return "text-red-600 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-900/20 dark:border-red-700";
      case "critical":
        return "text-red-600 bg-red-50 border-red-200 animate-pulse dark:text-red-400 dark:bg-red-900/20 dark:border-red-800";
      case "warning":
        return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800";
      default:
        return "text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/50 dark:border-slate-700";
    }
  }, []);

  // Timer effect
  useEffect(() => {
    if (!isActive || isExpired) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = Math.max(0, prev - 1);

        // Check warning levels
        const warningLevel = getWarningLevel(newTime);
        onWarning(warningLevel, newTime);

        // Handle expiration
        if (newTime === 0) {
          setIsExpired(true);
          onTimeExpired();
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isExpired, getWarningLevel, onTimeExpired, onWarning]);

  const warningLevel = getWarningLevel(timeRemaining);
  const timerColor = getTimerColor(warningLevel);
  const progressPercentage = (timeRemaining / totalSeconds) * 100;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Timer Display */}
      <div className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-mono text-lg font-bold transition-all duration-300
        ${timerColor}
      `}>
        <span className="text-xl">
          {warningLevel === "expired" ? "⏰" :
           warningLevel === "critical" ? "⚠️" :
           warningLevel === "warning" ? "⏳" : "⏱️"}
        </span>
        <span>{formatTime(timeRemaining)}</span>
        {warningLevel === "expired" && <span className="text-xs">EXPIRED</span>}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
        <div
          className={`
            h-full transition-all duration-1000 ease-linear
            ${warningLevel === "expired" ? "bg-red-500" :
             warningLevel === "critical" ? "bg-red-500 animate-pulse" :
             warningLevel === "warning" ? "bg-amber-500" : "bg-green-500"}
          `}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Status Text */}
      {timeRemaining > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {warningLevel === "critical" && "⚠️ Less than 5 minutes remaining!"}
          {warningLevel === "warning" && "⏳ 10 minutes remaining"}
          {warningLevel === "normal" && `${Math.floor(timeRemaining / 60)} minutes remaining`}
        </p>
      )}
    </div>
  );
}

/**
 * Hook for managing timer state across components
 */
export function useExamTimer(totalMinutes: number) {
  const [totalSeconds] = useState(totalMinutes * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [warningLevel, setWarningLevel] = useState<TimerWarning>("normal");
  const [isActive, setIsActive] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const timeRemaining = Math.max(0, totalSeconds - elapsedSeconds);

  // Calculate warning levels
  const updateWarningLevel = useCallback((remaining: number) => {
    const level = remaining <= 0 ? "expired" :
                 remaining <= 300 ? "critical" :
                 remaining <= 600 ? "warning" : "normal";
    setWarningLevel(level);
    return level;
  }, []);

  // Timer effect
  useEffect(() => {
    if (!isActive || isExpired) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const newElapsed = prev + 1;
        const remaining = Math.max(0, totalSeconds - newElapsed);

        const level = updateWarningLevel(remaining);

        if (remaining === 0) {
          setIsExpired(true);
          setIsActive(false);
        }

        return newElapsed;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isExpired, totalSeconds, updateWarningLevel]);

  const start = useCallback(() => {
    setIsActive(true);
    setElapsedSeconds(0);
    setIsExpired(false);
    setWarningLevel("normal");
  }, []);

  const pause = useCallback(() => {
    setIsActive(false);
  }, []);

  const resume = useCallback(() => {
    if (!isExpired) {
      setIsActive(true);
    }
  }, [isExpired]);

  const reset = useCallback(() => {
    setIsActive(false);
    setElapsedSeconds(0);
    setIsExpired(false);
    setWarningLevel("normal");
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    timeRemaining,
    elapsedSeconds,
    warningLevel,
    isActive,
    isExpired,
    progressPercentage: (timeRemaining / totalSeconds) * 100,
    formatTime,
    start,
    pause,
    resume,
    reset,
  };
}