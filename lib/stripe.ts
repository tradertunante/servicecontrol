import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY env var");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

/**
 * Map Stripe price interval to our DB interval.
 */
export function normalizeInterval(interval: string | null | undefined): "month" | "year" {
  return interval === "year" ? "year" : "month";
}

/**
 * Map Stripe subscription status to our DB status.
 */
export function normalizeStatus(status: Stripe.Subscription.Status): string {
  const allowed = ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired"];
  return allowed.includes(status) ? status : "unpaid";
}
