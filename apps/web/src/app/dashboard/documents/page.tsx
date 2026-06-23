import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DocumentsPanel,
  type DocumentRow,
} from "@/components/documents/documents-panel";

export const dynamic = "force-dynamic";

const DOC_COLUMNS =
  "id,title,original_filename,storage_path,file_size_bytes,page_count,status,processing_error,created_at";

export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: documents } = await supabase
    .from("documents")
    .select(DOC_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-[var(--fg-strong)]">
          Documents
        </h1>
        <p className="text-sm text-[var(--fg-muted)]">
          Upload a PDF to index it for source-grounded quizzes, cram sets, and
          mock exams. Processing runs in the background.
        </p>
      </div>

      <DocumentsPanel
        userId={user.id}
        initialDocuments={(documents ?? []) as DocumentRow[]}
      />
    </div>
  );
}
