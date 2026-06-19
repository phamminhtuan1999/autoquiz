"use client";

import { Button } from "@heroui/react";

interface ReviewBarProps {
  onApprove?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onReject?: () => void;
  disabled?: boolean;
}

export function ReviewBar({ onApprove, onEdit, onRegenerate, onReject, disabled }: ReviewBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="primary"
        size="sm"
        onPress={onApprove}
        isDisabled={disabled}
      >
        Approve
      </Button>
      <Button
        variant="outline"
        size="sm"
        onPress={onEdit}
        isDisabled={disabled}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onPress={onRegenerate}
        isDisabled={disabled}
      >
        Regenerate
      </Button>
      <Button
        variant="danger-soft"
        size="sm"
        onPress={onReject}
        isDisabled={disabled}
        className="ml-auto"
      >
        Reject
      </Button>
    </div>
  );
}
