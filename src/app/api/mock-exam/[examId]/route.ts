import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();

    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { examId } = await params;

    // Fetch exam with user verification
    const { data: exam, error: examError } = await supabase
      .from("mock_exams")
      .select("*")
      .eq("id", examId)
      .eq("user_id", user.id)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ error: "Exam not found or access denied" }, { status: 404 });
    }

    return NextResponse.json(exam);
  } catch (error) {
    console.error("Error fetching exam:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}