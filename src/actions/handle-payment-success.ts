"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { recordCreditsForSession } from "@/lib/payments";

export async function handlePaymentSuccess(sessionId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "User not authenticated" };
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return { error: "Payment not completed" };
    }

    if (session.metadata?.userId !== user.id) {
      return { error: "Session does not belong to current user" };
    }

    const result = await recordCreditsForSession(session, "success");

    const alreadyProcessed = result.alreadyProcessed ?? false;

    return {
      success: alreadyProcessed ? true : result.success ?? false,
      alreadyProcessed,
      creditsAdded: result.amount ?? 0,
    };
  } catch (error) {
    console.error("Error handling payment success:", error);
    return { error: "Internal server error" };
  }
}