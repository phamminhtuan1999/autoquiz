import { NextResponse } from "next/server";

export async function POST() {
  console.log("Test webhook endpoint hit");
  return NextResponse.json({ test: "success" });
}

export async function GET() {
  return NextResponse.json({ 
    message: "Webhook test endpoint",
    timestamp: new Date().toISOString()
  });
}