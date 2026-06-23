import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewStudio } from "@/components/review/review-studio";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ReviewStudio />
    </div>
  );
}
