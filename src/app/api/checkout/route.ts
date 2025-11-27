import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const stripe = getStripe();
  console.log("Creating checkout session for user:", user.id);
  
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Document-to-Quiz Credits (10)" },
          unit_amount: 990,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/dashboard?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard?canceled=1`,
    metadata: {
      userId: user.id,
    },
  });

  console.log("Checkout session created:", {
    sessionId: session.id,
    userId: user.id,
    metadata: session.metadata
  });

  return NextResponse.json({ url: session.url });
}
