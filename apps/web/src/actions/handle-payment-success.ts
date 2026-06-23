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
      console.error("User not authenticated when handling payment success");
      return { error: "User not authenticated" };
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      console.error(`Payment not completed. Status: ${session.payment_status}`);
      return { error: "Payment not completed" };
    }

    if (session.metadata?.userId !== user.id) {
      console.error(
        `Session userId mismatch. Expected: ${user.id}, Got: ${session.metadata?.userId}`
      );
      return { error: "Session does not belong to current user" };
    }

    const result = await recordCreditsForSession(session, "success");

    const alreadyProcessed = result.alreadyProcessed ?? false;
    const success = alreadyProcessed ? true : result.success ?? false;

    return {
      success,
      alreadyProcessed,
      creditsAdded: result.amount ?? 0,
    };
  } catch (error) {
    console.error("Error handling payment success:", error);
    return { error: (error as Error).message || "Internal server error" };
  }
}
