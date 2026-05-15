import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { markDemoBooked } from "@/lib/brevo";
import { logger } from "@/lib/logger";

const CAL_SECRET = process.env.CAL_WEBHOOK_SECRET;

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!CAL_SECRET || !signature) return false;
  const expected = "sha256=" + createHmac("sha256", CAL_SECRET).update(rawBody).digest("hex");
  try {
    const a = new Uint8Array(Buffer.from(signature));
    const b = new Uint8Array(Buffer.from(expected));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-cal-signature-256");

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload as {
    triggerEvent?: string;
    payload?: { attendees?: { email: string }[] };
  };

  // Cal.com ping test has no signature — allow it through for connectivity checks
  if (event.triggerEvent === "PING") {
    return NextResponse.json({ received: true, pong: true });
  }

  // All other events require a valid signature
  if (!verifySignature(rawBody, signature)) {
    logger.warn("cal_webhook_invalid_signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.triggerEvent !== "BOOKING_CREATED") {
    return NextResponse.json({ received: true, skipped: "unhandled_event" });
  }

  const email = event.payload?.attendees?.[0]?.email;
  if (!email) {
    logger.warn("cal_webhook_missing_email");
    return NextResponse.json({ error: "Missing attendee email" }, { status: 400 });
  }

  await markDemoBooked(email);
  logger.info("cal_demo_booked", { email });

  return NextResponse.json({ received: true });
}