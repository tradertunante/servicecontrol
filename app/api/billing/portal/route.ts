import { NextRequest, NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { authorizeRouteRequest } from "@/lib/auth/server";
import { jsonError } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { billingAdmin, type BillingAccountRow } from "@/lib/billing/db";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session and returns the URL.
 */
export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request, {
    roles: ["admin", "superadmin"],
  });
  if (!caller) return jsonError("No autorizado.", 401);

  const { data: account } = await billingAdmin()
    .from("billing_accounts")
    .select("id, provider_customer_id")
    .eq("owner_user_id", caller.profile.id)
    .maybeSingle() as { data: Pick<BillingAccountRow, "id" | "provider_customer_id"> | null };

  if (!account?.provider_customer_id) {
    return jsonError("No tienes una suscripción activa. Primero elige un plan.", 404);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: account.provider_customer_id,
    return_url: `${baseUrl}/billing`,
  });

  logger.info("billing_portal_created", {
    userId: caller.profile.id,
    billingAccountId: account.id,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
