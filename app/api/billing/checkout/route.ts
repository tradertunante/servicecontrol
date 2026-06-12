import { NextRequest, NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { authorizeRouteRequest, resolveRouteHotelScope } from "@/lib/auth/server";
import { jsonError } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { billingAdmin, type BillingAccountRow } from "@/lib/billing/db";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_PLANS = ["starter", "professional", "enterprise"];
const VALID_INTERVALS = ["month", "year"];

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for a new subscription.
 * Body: { plan_code: string, interval: "month" | "year" }
 */
export async function POST(request: NextRequest) {
  const caller = await authorizeRouteRequest(request);
  if (!caller) return jsonError("No autorizado.", 401);

  const isTrialUser = caller.profile.is_trial === true;
  const isAdminUser = caller.profile.role === "admin" || caller.profile.role === "superadmin";
  if (!isAdminUser && !isTrialUser) {
    return jsonError("No autorizado.", 403);
  }

  const body = await request.json().catch(() => null);
  const planCode = typeof body?.plan_code === "string" ? body.plan_code.trim() : "";
  const interval = typeof body?.interval === "string" ? body.interval.trim() : "month";

  if (!VALID_PLANS.includes(planCode)) {
    return jsonError(`Plan inválido. Opciones: ${VALID_PLANS.join(", ")}`);
  }
  if (!VALID_INTERVALS.includes(interval)) {
    return jsonError("Intervalo inválido. Usa 'month' o 'year'.");
  }

  // Find or create billing account
  let { data: account } = await billingAdmin()
    .from("billing_accounts")
    .select("id, provider_customer_id, email")
    .eq("owner_user_id", caller.profile.id)
    .maybeSingle() as { data: Pick<BillingAccountRow, "id" | "provider_customer_id" | "email"> | null };

  if (!account) {
    // Profile doesn't have email; look it up from Supabase Auth
    const { data: authUser } = await supabaseAdmin().auth.admin.getUserById(caller.profile.id);
    const email = authUser?.user?.email ?? `${caller.profile.id}@servicecontrol.app`;

    const { data: newAccount, error } = await billingAdmin()
      .from("billing_accounts")
      .insert({ owner_user_id: caller.profile.id, email, provider: "stripe" })
      .select("id, provider_customer_id, email")
      .single() as { data: Pick<BillingAccountRow, "id" | "provider_customer_id" | "email"> | null; error: unknown };

    if (error || !newAccount) {
      logger.error("billing_account_creation_failed", { userId: caller.profile.id });
      return jsonError("Error al crear cuenta de facturación.", 500);
    }

    account = newAccount;
  }

  // Trial users are in a shared demo hotel — skip linking to avoid polluting it.
  // Their real hotel gets linked after completing hotel creation post-checkout.
  const hotelResult = isTrialUser ? { ok: false as const } : await resolveRouteHotelScope(caller.profile, null);
  if (hotelResult.ok) {
    const { data: hotel } = await supabaseAdmin()
      .from("hotels")
      .select("billing_account_id")
      .eq("id", hotelResult.hotelId)
      .maybeSingle();

    if (!hotel?.billing_account_id) {
      const { error: linkError } = await supabaseAdmin()
        .from("hotels")
        .update({ billing_account_id: account.id })
        .eq("id", hotelResult.hotelId)
        .is("billing_account_id", null);

      if (linkError) {
        logger.error("billing_hotel_link_failed", {
          hotelId: hotelResult.hotelId,
          billingAccountId: account.id,
          error: linkError.message,
        });
        return jsonError("Error al vincular el hotel con la cuenta de facturación.", 500);
      }
    } else if (hotel.billing_account_id !== account.id) {
      // Hotel already belongs to another billing account — refuse instead of hijacking it.
      logger.warn("billing_hotel_already_linked", {
        hotelId: hotelResult.hotelId,
        existingAccountId: hotel.billing_account_id,
        requestedAccountId: account.id,
      });
      return jsonError("Este hotel ya está vinculado a otra cuenta de facturación.", 409);
    }
  } else {
    logger.warn("billing_checkout_no_hotel_scope", {
      userId: caller.profile.id,
      billingAccountId: account.id,
    });
  }

  // Find Stripe Price by lookup_key convention: "{plan_code}_{interval}"
  const lookupKey = `${planCode}_${interval}`;
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });

  if (prices.data.length === 0) {
    logger.error("billing_price_not_found", { lookupKey });
    return jsonError("Plan no disponible en este momento.", 500);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const sessionParams: Record<string, unknown> = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: prices.data[0].id, quantity: 1 }],
    success_url: `${baseUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/billing`,
    metadata: { billing_account_id: account.id, plan_code: planCode },
    subscription_data: {
      metadata: { billing_account_id: account.id, plan_code: planCode },
    },
  };

  if (account.provider_customer_id) {
    sessionParams.customer = account.provider_customer_id;
  } else {
    sessionParams.customer_email = account.email;
  }

  if (planCode === "starter") {
    (sessionParams.subscription_data as Record<string, unknown>).trial_period_days = 14;
  }

  const session = await stripe.checkout.sessions.create(
    sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0],
  );

  logger.info("billing_checkout_created", {
    userId: caller.profile.id,
    billingAccountId: account.id,
    planCode,
    interval,
    sessionId: session.id,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
