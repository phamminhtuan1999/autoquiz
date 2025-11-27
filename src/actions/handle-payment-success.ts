"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { getStripe } from "@/lib/stripe";

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

    // Add credits using service role client
    const adminSupabase = createServiceRoleClient();
    const { error } = await adminSupabase.rpc("add_credits", {
      p_user_id: user.id,
      p_amount: 10,
    } as never);

    if (error) {
      console.error("Failed to add credits in success handler:", error);
      return { error: "Failed to add credits" };
    }

    return { success: true, creditsAdded: 10 };
  } catch (error) {
    console.error("Error handling payment success:", error);
    return { error: "Internal server error" };
  }
}