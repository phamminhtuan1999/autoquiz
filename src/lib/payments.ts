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

  const { data: existing, error: fetchError } = await supabase
    .from("payment_events")
    .select("session_id")
    .eq("session_id", session.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to check payment_events: ${fetchError.message}`);
  }

  if (existing) {
    console.log(
      `Stripe session ${session.id} already processed, skipping credit addition`
    );
    return { alreadyProcessed: true };
  }

  const { error: creditError } = await supabase.rpc("add_credits", {
    p_user_id: userId,
    p_amount: CREDITS_PER_PURCHASE,
  } as never);

  if (creditError) {
    throw new Error(`Failed to add credits: ${creditError.message}`);
  }

  const { error: insertError } = await supabase.from("payment_events").insert({
    session_id: session.id,
    user_id: userId,
    amount: CREDITS_PER_PURCHASE,
    source,
  } as never);

  if (insertError) {
    throw new Error(
      `Credits added but failed to record payment event: ${insertError.message}`
    );
  }

  return { success: true, amount: CREDITS_PER_PURCHASE };
}

