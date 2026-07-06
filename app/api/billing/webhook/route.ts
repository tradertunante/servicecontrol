import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe, normalizeInterval, normalizeStatus } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { billingAdmin, type BillingAccountRow } from "@/lib/billing/db";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendCheckoutNotificationEmail } from "@/lib/email/sendCheckoutNotificationEmail";
import { provisionAccountAccess } from "@/lib/billing/provisioning";
import { getPlan } from "@/lib/billing/plans";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler with signature verification and idempotency.
 */
export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    logger.error("stripe_webhook_missing_secret");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    logger.error("stripe_webhook_signature_invalid", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check
  const { data: existing } = await billingAdmin()
    .from("billing_events")
    .select("id, status")
    .eq("provider_event_id", event.id)
    .maybeSingle() as { data: { id: string; status: string } | null };

  if (existing?.status === "processed") {
    return NextResponse.json({ received: true, skipped: "already_processed" });
  }

  // Store raw event
  if (!existing) {
    await billingAdmin().from("billing_events").insert({
      provider: "stripe",
      provider_event_id: event.id,
      type: event.type,
      payload: event.data.object as unknown as Record<string, unknown>,
      status: "pending",
    });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    await billingAdmin()
      .from("billing_events")
      .update({ status: "skipped", processed_at: new Date().toISOString() })
      .eq("provider_event_id", event.id);
    return NextResponse.json({ received: true, skipped: "unhandled_type" });
  }

  try {
    await processEvent(event);

    await billingAdmin()
      .from("billing_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider_event_id", event.id);

    logger.info("stripe_webhook_processed", { type: event.type, eventId: event.id });
  } catch (err) {
    logger.error("stripe_webhook_processing_failed", {
      type: event.type,
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });

    await billingAdmin()
      .from("billing_events")
      .update({ status: "failed", processed_at: new Date().toISOString() })
      .eq("provider_event_id", event.id);

    // 5xx para que Stripe reintente (con 200 da el evento por entregado y no
    // vuelve). Reprocesar es seguro: los handlers son idempotentes y los
    // eventos ya procesados se saltan arriba.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function processEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const billingAccountId = session.metadata?.billing_account_id;

  if (!customerId || !billingAccountId) {
    logger.warn("stripe_checkout_missing_metadata", { customerId, billingAccountId, sessionId: session.id });
    return;
  }

  await billingAdmin()
    .from("billing_accounts")
    .update({ provider_customer_id: customerId })
    .eq("id", billingAccountId)
    .is("provider_customer_id", null);

  const { data: account } = await billingAdmin()
    .from("billing_accounts")
    .select("owner_user_id")
    .eq("id", billingAccountId)
    .maybeSingle() as { data: { owner_user_id: string } | null };

  const planCode = session.metadata?.plan_code ?? "unknown";

  // La suscripción puede haber llegado en un evento anterior al set del
  // provider_customer_id (orden de webhooks no garantizado): upsert directo.
  const rawSessionSub = session.subscription;
  const sessionSubId = typeof rawSessionSub === "string" ? rawSessionSub : rawSessionSub?.id;
  if (sessionSubId) {
    const sub = await stripe.subscriptions.retrieve(sessionSubId);
    await upsertSubscription(sub);
  }

  // Alta automática: hotel propio + rol admin + packs del plan.
  // Si falla, el evento queda en "failed" y Stripe reintenta (es idempotente).
  let provisioning: { hotelId: string | null; created: boolean } = { hotelId: null, created: false };
  if (account?.owner_user_id) {
    provisioning = await provisionAccountAccess({
      billingAccountId,
      ownerUserId: account.owner_user_id,
      planCode,
    });
  } else {
    logger.warn("billing_checkout_account_without_owner", { billingAccountId, sessionId: session.id });
  }

  logger.info("billing_checkout_completed", {
    billingAccountId,
    customerId,
    sessionId: session.id,
    hotelId: provisioning.hotelId,
    hotelCreated: provisioning.created,
  });

  // Aviso a ventas (informativo — el alta ya es automática)
  try {
    await sendCheckoutNotificationEmail({
      customerEmail: session.customer_details?.email ?? session.customer_email ?? "desconocido",
      planCode,
      billingAccountId,
      sessionId: session.id,
      hotelId: provisioning.hotelId,
      hotelCreated: provisioning.created,
    });
  } catch (err) {
    logger.warn("checkout_notification_email_failed", {
      sessionId: session.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const { data: account } = await billingAdmin()
    .from("billing_accounts")
    .select("id")
    .eq("provider_customer_id", customerId)
    .maybeSingle() as { data: Pick<BillingAccountRow, "id"> | null };

  if (!account) {
    logger.warn("stripe_subscription_no_account", { customerId, subscriptionId: sub.id });
    return;
  }

  const item = sub.items.data[0];
  // lookup_key es `${plan_code}_${month|year}` — quitar el sufijo si falta metadata.
  const planCode =
    item?.price?.metadata?.plan_code ??
    item?.price?.lookup_key?.replace(/_(month|year)$/, "") ??
    "unknown";

  // Desde la API Basil (2025-03-31) current_period_* vive en el item de la
  // suscripción, no en la suscripción; el fallback cubre payloads de webhooks
  // configurados con una versión de API anterior.
  const legacyPeriods = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const periodStart = item?.current_period_start ?? legacyPeriods.current_period_start ?? null;
  const periodEnd = item?.current_period_end ?? legacyPeriods.current_period_end ?? null;

  const row = {
    billing_account_id: account.id,
    provider_subscription_id: sub.id,
    plan_code: planCode,
    status: normalizeStatus(sub.status),
    interval: normalizeInterval(item?.price?.recurring?.interval),
    amount: item?.price?.unit_amount ?? 0,
    currency: sub.currency ?? "eur",
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  };

  const { error } = await billingAdmin()
    .from("billing_subscriptions")
    .upsert(row, { onConflict: "provider_subscription_id" });

  if (error) {
    logger.error("billing_subscription_upsert_failed", { error: (error as { message?: string }).message, subscriptionId: sub.id });
    throw error;
  }

  // Cambios de plan desde el portal de Stripe: sincronizar los módulos del hotel.
  const plan = getPlan(planCode);
  if (plan && (sub.status === "active" || sub.status === "trialing")) {
    const { error: packsError } = await supabaseAdmin()
      .from("hotels")
      .update({ enabled_packs: plan.enabledPacks })
      .eq("billing_account_id", account.id);

    if (packsError) {
      logger.warn("billing_packs_sync_failed", { billingAccountId: account.id, planCode, error: packsError.message });
    }
  }

  logger.info("billing_subscription_upserted", {
    billingAccountId: account.id,
    subscriptionId: sub.id,
    status: sub.status,
    planCode,
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await billingAdmin()
    .from("billing_subscriptions")
    .update({ status: "canceled" })
    .eq("provider_subscription_id", sub.id);

  logger.info("billing_subscription_canceled", { subscriptionId: sub.id });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const rawSub = (invoice as any).subscription;
  const subId = typeof rawSub === "string" ? rawSub : rawSub?.id;
  if (!subId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  await upsertSubscription(sub);

  logger.info("billing_payment_succeeded", { invoiceId: invoice.id, subscriptionId: subId, amount: invoice.amount_paid });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const rawSub = (invoice as any).subscription;
  const subId = typeof rawSub === "string" ? rawSub : rawSub?.id;
  if (!subId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  await upsertSubscription(sub);

  logger.warn("billing_payment_failed", { invoiceId: invoice.id, subscriptionId: subId, amount: invoice.amount_due });
}
