"use client";

import { Button } from "@heroui/react";

interface EmptyStateProps {
  heading: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  icon?: React.ReactNode;
}

export function EmptyState({ heading, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      {icon && (
        <div className="text-[var(--fg-faint)]">{icon}</div>
      )}
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-[var(--fg)]">{heading}</p>
        {description && (
          <p className="text-sm text-[var(--fg-muted)]">{description}</p>
        )}
      </div>
      {action && (
        <Button variant="primary" size="sm" onPress={action.onPress}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
