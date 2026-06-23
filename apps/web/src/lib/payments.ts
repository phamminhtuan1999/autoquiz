import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

const CREDITS_PER_PURCHASE = 10;

type ProcessResult = {
  success?: boolean;
  alreadyProcessed?: boolean;
  amount?: number;
};

export async function recordCreditsForSession(
  session: Stripe.Checkout.Session,
  source: "webhook" | "success" = "webhook"
): Promise<ProcessResult> {
  const userId = session.metadata?.userId;

  if (!userId) {
    throw new Error("Missing userId metadata on Stripe session");
  }

  const supabase = createServiceRoleClient();

  // Verify user profile exists before processing
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, credits")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error(`Profile not found for user ${userId}:`, profileError);
    throw new Error(
      `User profile not found: ${
        profileError?.message || "Profile does not exist"
      }`
    );
  }

  // Try to insert payment event first - this acts as an atomic check
  // If the session_id already exists, the insert will fail due to primary key constraint
  const { error: insertError } = await supabase.from("payment_events").insert({
    session_id: session.id,
    user_id: userId,
    amount: CREDITS_PER_PURCHASE,
    source,
  } as never);

  // If insert failed due to duplicate key, payment was already processed
  if (insertError) {
    // Check if it's a duplicate key error (payment already processed)
    if (insertError.code === "23505" || insertError.message.includes("duplicate")) {
      return { alreadyProcessed: true };
    }
    // Otherwise, it's a real error
    throw new Error(`Failed to record payment event: ${insertError.message}`);
  }

  // Payment event inserted successfully, now add credits atomically
  const { error: creditError } = await supabase.rpc("add_credits", {
    p_user_id: userId,
    p_amount: CREDITS_PER_PURCHASE,
  } as never);

  if (creditError) {
    console.error(`Failed to add credits via RPC:`, creditError);
    // Try to rollback the payment event insert
    await supabase
      .from("payment_events")
      .delete()
      .eq("session_id", session.id);
    throw new Error(`Failed to add credits: ${creditError.message}`);
  }

  // Verify credits were actually added
  const { data: updatedProfile, error: verifyError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (verifyError) {
    console.error(`Failed to verify credits after addition:`, verifyError);
  } else if (updatedProfile) {
    const updatedCredits = (updatedProfile as { credits: number }).credits;
    const profileCredits = (profile as { credits: number }).credits;
    const expectedCredits = profileCredits + CREDITS_PER_PURCHASE;
    if (updatedCredits !== expectedCredits) {
      console.error(
        `Credit addition mismatch! Expected ${expectedCredits}, got ${updatedCredits}`
      );
    }
  }

  return { success: true, amount: CREDITS_PER_PURCHASE };
}
