"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";

interface SourceRefProps {
  page?: number;
  passage: string;
  children?: React.ReactNode;
}

export function SourceRef({ page, passage, children }: SourceRefProps) {
  return (
    <Popover>
      <PopoverTrigger>
        <span className="inline-flex cursor-pointer items-center gap-1 rounded border border-[var(--info-border)] bg-[var(--info-bg)] px-1.5 py-0.5 font-mono text-xs text-[var(--info)] hover:opacity-80 transition-opacity">
          {children ?? (page != null ? `p.${page}` : "source")}
        </span>
      </PopoverTrigger>
      <PopoverContent>
        <div className="max-w-xs p-3">
          {page != null && (
            <p className="mb-1 font-mono text-xs text-[var(--fg-muted)]">Page {page}</p>
          )}
          <p className="text-sm text-[var(--fg)] leading-relaxed">{passage}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
