/**
 * Untyped Supabase access for billing tables.
 *
 * The billing tables are not in the generated Database type yet.
 * After running the migration + `supabase gen types`, replace this
 * with proper typed access and delete this file.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type BillingAccountRow = {
  id: string;
  owner_user_id: string;
  provider: string;
  provider_customer_id: string | null;
  email: string;
  company_name: string | null;
  tax_id: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingSubscriptionRow = {
  id: string;
  billing_account_id: string;
  provider_subscription_id: string;
  plan_code: string;
  status: string;
  interval: string;
  amount: number;
  currency: string;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanEntitlementRow = {
  plan_code: string;
  name: string;
  max_hotels: number;
  max_users_per_hotel: number;
  max_audits_per_month: number;
  reports_enabled: boolean;
  training_enabled: boolean;
  analytics_enabled: boolean;
  created_at: string;
};

/**
 * Returns an untyped Supabase admin client.
 * All billing queries go through this to avoid type errors
 * until the generated types include the billing tables.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function billingAdmin(): any {
  return supabaseAdmin();
}
