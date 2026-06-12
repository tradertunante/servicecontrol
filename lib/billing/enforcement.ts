import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getActiveSubscription,
  getActiveSubscriptionForHotel,
  type PlanEntitlements,
} from "./getActiveSubscription";

type EnforcementResult =
  | { allowed: true }
  | { allowed: false; reason: string; code: string };

/**
 * Check if a hotel can create more audits this month.
 * Resolved via hotels.billing_account_id — never via the caller, who is
 * usually an auditor/manager without a billing account of their own.
 * If the hotel has no billing account yet, allow (grace period until billing is set up).
 */
export async function canCreateAudit(hotelId: string): Promise<EnforcementResult> {
  const billing = await getActiveSubscriptionForHotel(hotelId);

  // No billing account = no enforcement yet (grace period)
  if (!billing.has_account) return { allowed: true };

  if (!billing.is_active && !billing.is_past_due) {
    return { allowed: false, reason: "Suscripción inactiva.", code: "subscription_inactive" };
  }

  if (billing.is_past_due) {
    return { allowed: false, reason: "Pago pendiente. Actualiza tu método de pago.", code: "payment_past_due" };
  }

  const entitlements = billing.subscription!.entitlements;
  const count = await getMonthlyAuditCount(hotelId);

  if (count >= entitlements.max_audits_per_month) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${entitlements.max_audits_per_month} auditorías/mes de tu plan.`,
      code: "audit_limit_reached",
    };
  }

  return { allowed: true };
}

/**
 * Check if a hotel can add more users.
 * Resolved via hotels.billing_account_id (see canCreateAudit).
 * If the hotel has no billing account yet, allow (grace period).
 */
export async function canAddUser(hotelId: string): Promise<EnforcementResult> {
  const billing = await getActiveSubscriptionForHotel(hotelId);

  if (!billing.has_account) return { allowed: true };

  if (!billing.is_active) {
    return { allowed: false, reason: "Suscripción inactiva.", code: "subscription_inactive" };
  }

  const entitlements = billing.subscription!.entitlements;
  const count = await getHotelUserCount(hotelId);

  if (count >= entitlements.max_users_per_hotel) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${entitlements.max_users_per_hotel} usuarios por hotel de tu plan.`,
      code: "user_limit_reached",
    };
  }

  return { allowed: true };
}

/**
 * Check if a billing account can add more hotels.
 * If no billing account exists yet, allow (grace period).
 */
export async function canAddHotel(userId: string): Promise<EnforcementResult> {
  const billing = await getActiveSubscription(userId);

  if (!billing.has_account) return { allowed: true };

  if (!billing.is_active) {
    return { allowed: false, reason: "Suscripción inactiva.", code: "subscription_inactive" };
  }

  const entitlements = billing.subscription!.entitlements;
  const count = await getAccountHotelCount(billing.billing_account_id!);

  if (count >= entitlements.max_hotels) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${entitlements.max_hotels} hoteles de tu plan.`,
      code: "hotel_limit_reached",
    };
  }

  return { allowed: true };
}

/**
 * Check if a feature is enabled for the hotel's plan.
 */
export async function canAccessFeature(
  hotelId: string,
  feature: keyof Pick<PlanEntitlements, "reports_enabled" | "training_enabled" | "analytics_enabled">,
): Promise<EnforcementResult> {
  const billing = await getActiveSubscriptionForHotel(hotelId);

  if (!billing.has_account) return { allowed: true };

  if (!billing.is_active && !billing.is_past_due) {
    return { allowed: false, reason: "Suscripción inactiva.", code: "subscription_inactive" };
  }

  const entitlements = billing.subscription?.entitlements;
  if (!entitlements || !entitlements[feature]) {
    return {
      allowed: false,
      reason: "Esta función no está incluida en tu plan actual.",
      code: "feature_not_included",
    };
  }

  return { allowed: true };
}

// --- Counting helpers ---

async function getMonthlyAuditCount(hotelId: string): Promise<number> {
  const admin = supabaseAdmin();
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { count } = await admin
    .from("audit_runs")
    .select("id", { count: "exact", head: true })
    .eq("hotel_id", hotelId)
    .gte("created_at", firstOfMonth);

  return count ?? 0;
}

async function getHotelUserCount(hotelId: string): Promise<number> {
  const admin = supabaseAdmin();

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("hotel_id", hotelId)
    .eq("active", true);

  return count ?? 0;
}

async function getAccountHotelCount(billingAccountId: string): Promise<number> {
  const admin = supabaseAdmin();

  const { count } = await admin
    .from("hotels")
    .select("id", { count: "exact", head: true })
    .eq("billing_account_id", billingAccountId)
    .eq("active", true);

  return count ?? 0;
}
