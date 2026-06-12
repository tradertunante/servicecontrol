import { billingAdmin, type BillingAccountRow, type BillingSubscriptionRow, type PlanEntitlementRow } from "./db";

export type PlanEntitlements = {
  plan_code: string;
  name: string;
  max_hotels: number;
  max_users_per_hotel: number;
  max_audits_per_month: number;
  reports_enabled: boolean;
  training_enabled: boolean;
  analytics_enabled: boolean;
};

export type ActiveSubscription = {
  subscription_id: string;
  plan_code: string;
  status: string;
  interval: "month" | "year";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  entitlements: PlanEntitlements;
};

export type BillingState = {
  has_account: boolean;
  billing_account_id: string | null;
  subscription: ActiveSubscription | null;
  is_active: boolean;
  is_past_due: boolean;
};

const FREE_ENTITLEMENTS: PlanEntitlements = {
  plan_code: "free",
  name: "Free",
  max_hotels: 1,
  max_users_per_hotel: 5,
  max_audits_per_month: 10,
  reports_enabled: false,
  training_enabled: false,
  analytics_enabled: false,
};

const NO_ACCOUNT_STATE: BillingState = {
  has_account: false,
  billing_account_id: null,
  subscription: null,
  is_active: false,
  is_past_due: false,
};

/**
 * Get billing state for a user (account owner). Server-side only (uses service_role).
 * Use this for the owner's billing page; for plan enforcement use
 * getActiveSubscriptionForHotel — limits apply to the hotel, not to whoever calls.
 */
export async function getActiveSubscription(userId: string): Promise<BillingState> {
  const { data: account } = await billingAdmin()
    .from("billing_accounts")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle() as { data: Pick<BillingAccountRow, "id"> | null };

  if (!account) return NO_ACCOUNT_STATE;

  return getBillingStateForAccount(account.id);
}

/**
 * Get billing state for a hotel via hotels.billing_account_id.
 * This is the resolution enforcement must use: audits/users are created by
 * auditors and managers who never own the billing account.
 */
export async function getActiveSubscriptionForHotel(hotelId: string): Promise<BillingState> {
  const { data: hotel } = await billingAdmin()
    .from("hotels")
    .select("billing_account_id")
    .eq("id", hotelId)
    .maybeSingle() as { data: { billing_account_id: string | null } | null };

  if (!hotel?.billing_account_id) return NO_ACCOUNT_STATE;

  return getBillingStateForAccount(hotel.billing_account_id);
}

async function getBillingStateForAccount(accountId: string): Promise<BillingState> {
  // Find best subscription (active > trialing > past_due)
  const { data: subs } = await billingAdmin()
    .from("billing_subscriptions")
    .select("*")
    .eq("billing_account_id", accountId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1) as { data: BillingSubscriptionRow[] | null };

  const sub = subs?.[0] ?? null;

  if (!sub) {
    return { has_account: true, billing_account_id: accountId, subscription: null, is_active: false, is_past_due: false };
  }

  // 3. Load entitlements
  const { data: entitlements } = await billingAdmin()
    .from("plan_entitlements")
    .select("*")
    .eq("plan_code", sub.plan_code)
    .maybeSingle() as { data: PlanEntitlementRow | null };

  const plan: PlanEntitlements = entitlements
    ? {
        plan_code: entitlements.plan_code,
        name: entitlements.name,
        max_hotels: entitlements.max_hotels,
        max_users_per_hotel: entitlements.max_users_per_hotel,
        max_audits_per_month: entitlements.max_audits_per_month,
        reports_enabled: entitlements.reports_enabled,
        training_enabled: entitlements.training_enabled,
        analytics_enabled: entitlements.analytics_enabled,
      }
    : { ...FREE_ENTITLEMENTS, plan_code: sub.plan_code, name: sub.plan_code };

  return {
    has_account: true,
    billing_account_id: accountId,
    subscription: {
      subscription_id: sub.id,
      plan_code: sub.plan_code,
      status: sub.status,
      interval: sub.interval as "month" | "year",
      current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end,
      trial_end: sub.trial_end,
      entitlements: plan,
    },
    is_active: sub.status === "active" || sub.status === "trialing",
    is_past_due: sub.status === "past_due",
  };
}
