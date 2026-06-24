"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  FileUp,
  FileText,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GenerateQuizControl } from "@/components/documents/generate-quiz-control";

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB — matches the documents bucket limit
const POLL_MS = 4000;

export type DocStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "unsupported";

export type DocumentRow = {
  id: string;
  title: string;
  original_filename: string | null;
  storage_path: string;
  file_size_bytes: number | null;
  page_count: number | null;
  status: DocStatus;
  processing_error: string | null;
  created_at: string;
};

type JobRow = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  progress: number;
  current_step: string | null;
  error_message: string | null;
  input: { document_id?: string } | null;
  created_at: string;
};

const DOC_COLUMNS =
  "id,title,original_filename,storage_path,file_size_bytes,page_count,status,processing_error,created_at";
const JOB_COLUMNS = "id,status,progress,current_step,error_message,input,created_at";

const STATUS_META: Record<
  DocStatus,
  { label: string; badge: string; icon: typeof Clock }
> = {
  uploaded: {
    label: "Queued",
    badge:
      "border-[var(--amber-border)] bg-[var(--amber-bg)] text-[var(--amber)]",
    icon: Clock,
  },
  processing: {
    label: "Processing",
    badge: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]",
    icon: Loader2,
  },
  ready: {
    label: "Ready",
    badge:
      "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    badge:
      "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]",
    icon: AlertCircle,
  },
  unsupported: {
    label: "Unsupported",
    badge:
      "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]",
    icon: AlertCircle,
  },
};

function formatBytes(bytes: number | null): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTerminal(status: DocStatus): boolean {
  return status === "ready" || status === "failed" || status === "unsupported";
}

interface DocumentsPanelProps {
  userId: string;
  initialDocuments: DocumentRow[];
}

export function DocumentsPanel({ userId, initialDocuments }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [jobsByDoc, setJobsByDoc] = useState<Record<string, JobRow>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPending = useMemo(
    () => documents.some((d) => !isTerminal(d.status)),
    [documents]
  );

  // Poll for status only while something is still in flight; stop when all
  // documents reach a terminal state. The web app never writes status — it
  // reads documents.status + the process_document job for progress/step.
  useEffect(() => {
    if (!hasPending) return;
    const supabase = createSupabaseBrowserClient();
    let active = true;

    const tick = async () => {
      const [{ data: docs }, { data: jobs }] = await Promise.all([
        supabase
          .from("documents")
          .select(DOC_COLUMNS)
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("ai_jobs")
          .select(JOB_COLUMNS)
          .eq("user_id", userId)
          .eq("job_type", "process_document")
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (docs) setDocuments(docs as DocumentRow[]);
      if (jobs) {
        const map: Record<string, JobRow> = {};
        for (const job of jobs as JobRow[]) {
          const docId = job.input?.document_id;
          if (docId && !map[docId]) map[docId] = job; // first = latest (desc)
        }
        setJobsByDoc(map);
      }
    };

    const interval = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [hasPending, userId]);

  const uploadFile = async (file: File) => {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("PDF must be 30 MB or smaller.");
      return;
    }

    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const docId = crypto.randomUUID();
    const path = `${userId}/${docId}/${file.name}`;

    try {
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const title = file.name.replace(/\.pdf$/i, "");
      const { data: inserted, error: docErr } = await supabase
        .from("documents")
        .insert({
          id: docId,
          user_id: userId,
          title,
          original_filename: file.name,
          storage_path: path,
          file_size_bytes: file.size,
        })
        .select(DOC_COLUMNS)
        .single();

      if (docErr || !inserted) {
        // Compensation: don't leave an orphaned object behind.
        await supabase.storage.from("documents").remove([path]);
        throw new Error(
          `Could not save document: ${docErr?.message ?? "unknown error"}`
        );
      }

      const { error: jobErr } = await supabase.from("ai_jobs").insert({
        user_id: userId,
        job_type: "process_document",
        input: { document_id: docId, storage_path: path },
      });
      if (jobErr) {
        setError(
          `Document saved, but processing could not be queued: ${jobErr.message}`
        );
      }

      setDocuments((prev) => [inserted as DocumentRow, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  };

  const handleDelete = async (doc: DocumentRow) => {
    if (
      !window.confirm(
        `Delete “${doc.title}”? This removes the PDF and its processing record.`
      )
    ) {
      return;
    }
    setDeletingId(doc.id);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    try {
      await supabase.storage.from("documents").remove([doc.storage_path]);
      const { error: delErr } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);
      if (delErr) throw new Error(delErr.message);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(`Delete failed: ${(err as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload control */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
            : "border-[var(--border-strong)] bg-[var(--bg-subtle)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-muted)]"
        } ${uploading ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
        ) : (
          <FileUp className="h-6 w-6 text-[var(--fg-subtle)]" />
        )}
        <span className="text-sm font-medium text-[var(--fg)]">
          {uploading ? "Uploading…" : "Drop a PDF here, or click to browse"}
        </span>
        <span className="text-xs text-[var(--fg-faint)]">
          PDF only · up to 30 MB · 150 pages
        </span>
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-[var(--r-sm)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Document list */}
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)]">
        {documents.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto h-7 w-7 text-[var(--fg-faint)]" />
            <p className="mt-3 text-sm text-[var(--fg-muted)]">
              No documents yet.
            </p>
            <p className="mt-1 text-xs text-[var(--fg-faint)]">
              Upload a PDF above to start building source-grounded quizzes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {documents.map((doc) => {
              const meta = STATUS_META[doc.status];
              const StatusIcon = meta.icon;
              const job = jobsByDoc[doc.id];
              const detail =
                doc.processing_error ?? job?.error_message ?? null;
              return (
                <li
                  key={doc.id}
                  className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--fg-subtle)]" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--fg)]">
                        {doc.title}
                      </p>
                      <span
                        className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.badge}`}
                      >
                        <StatusIcon
                          className={`h-3 w-3 ${
                            doc.status === "processing" ? "animate-spin" : ""
                          }`}
                        />
                        {meta.label}
                      </span>
                    </div>

                    <p className="mt-1 font-mono text-xs text-[var(--fg-faint)]">
                      {formatBytes(doc.file_size_bytes)}
                      {doc.page_count != null
                        ? ` · ${doc.page_count} pages`
                        : ""}
                      {" · "}
                      {new Date(doc.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>

                    {doc.status === "uploaded" && (
                      <p className="mt-1 text-xs text-[var(--fg-muted)]">
                        Waiting for a processing worker to pick this up.
                      </p>
                    )}

                    {doc.status === "processing" && (
                      <div className="mt-2 space-y-1">
                        {job?.current_step && (
                          <p className="text-xs text-[var(--fg-muted)]">
                            {job.current_step}
                          </p>
                        )}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                            style={{ width: `${job?.progress ?? 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {(doc.status === "failed" ||
                      doc.status === "unsupported") &&
                      detail && (
                        <p className="mt-1 text-xs text-[var(--danger)]">
                          {detail}
                        </p>
                      )}

                    {doc.status === "ready" && (
                      <div className="mt-2">
                        <GenerateQuizControl documentId={doc.id} />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    title="Delete document"
                    aria-label={`Delete ${doc.title}`}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--fg-subtle)] transition-colors hover:border-[var(--danger-border)] hover:text-[var(--danger)] disabled:opacity-50"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
