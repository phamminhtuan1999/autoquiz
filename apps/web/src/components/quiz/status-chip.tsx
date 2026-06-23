"use client";

import { Chip } from "@heroui/react";

const CONFIG = {
  drafted:      { color: "default",  label: "Drafted"      },
  "needs-review": { color: "warning", label: "Needs Review" },
  approved:     { color: "success",  label: "Approved"     },
  rejected:     { color: "danger",   label: "Rejected"     },
} as const;

export type ReviewStatus = keyof typeof CONFIG;

export function StatusChip({ status }: { status: ReviewStatus }) {
  const { color, label } = CONFIG[status];
  return (
    <Chip color={color} variant="soft" size="sm">
      {label}
    </Chip>
  );
}
