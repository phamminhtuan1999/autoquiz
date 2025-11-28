import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { recordCreditsForSession } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET environment variable");
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const headersList = await headers();
  const signature = headersList.get("stripe-signature");
  if (!signature) {
    console.error("Missing Stripe signature header");
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  const rawBody = Buffer.from(await req.arrayBuffer());
  let event: Stripe.Event;

  const stripe = getStripe();

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log("Webhook event verified:", event.type);
  } catch (err) {
    console.error(
      "Webhook signature verification failed:",
      (err as Error).message
    );
    return NextResponse.json(
      { error: `Invalid signature ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    console.log("Processing checkout session completed:", {
      sessionId: session.id,
      userId: userId,
      metadata: session.metadata,
    });

    if (!userId) {
      console.error("No userId found in session metadata");
      return NextResponse.json(
        { error: "Missing userId in session metadata" },
        { status: 400 }
      );
    }

    try {
      const result = await recordCreditsForSession(session, "webhook");
      const alreadyProcessed = result.alreadyProcessed ?? false;

      return NextResponse.json({
        success: alreadyProcessed ? true : result.success ?? false,
        alreadyProcessed,
        userId,
        amount: result.amount ?? 0,
      });
    } catch (err) {
      console.error("Error processing credit addition:", err);
      return NextResponse.json(
        { error: `Internal error: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  } else {
    console.log("Ignoring webhook event type:", event.type);
  }

  return NextResponse.json({ received: true });
}
