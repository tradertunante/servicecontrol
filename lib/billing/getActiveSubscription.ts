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

/**
 * Get billing state for a user. Server-side only (uses service_role).
 */
export async function getActiveSubscription(userId: string): Promise<BillingState> {
  // 1. Find billing account
  const { data: account } = await billingAdmin()
    .from("billing_accounts")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle() as { data: Pick<BillingAccountRow, "id"> | null };

  if (!account) {
    return { has_account: false, billing_account_id: null, subscription: null, is_active: false, is_past_due: false };
  }

  // 2. Find best subscription (active > trialing > past_due)
  const { data: subs } = await billingAdmin()
    .from("billing_subscriptions")
    .select("*")
    .eq("billing_account_id", account.id)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1) as { data: BillingSubscriptionRow[] | null };

  const sub = subs?.[0] ?? null;

  if (!sub) {
    return { has_account: true, billing_account_id: account.id, subscription: null, is_active: false, is_past_due: false };
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
    billing_account_id: account.id,
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
