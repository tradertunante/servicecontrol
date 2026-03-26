-- ============================================================
-- ServiceControl Billing System
-- Supports multi-hotel accounts, Stripe subscriptions, and plan enforcement.
-- ============================================================

-- 1. Billing Accounts (the paying entity — can own 1+ hotels)
CREATE TABLE public.billing_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  provider      text NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe')),
  provider_customer_id text UNIQUE,
  email         text NOT NULL,
  company_name  text,
  tax_id        text,
  country       text DEFAULT 'ES',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_accounts_owner ON public.billing_accounts (owner_user_id);
CREATE INDEX idx_billing_accounts_provider_customer ON public.billing_accounts (provider_customer_id) WHERE provider_customer_id IS NOT NULL;

-- 2. Link hotels to billing accounts
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS billing_account_id uuid REFERENCES public.billing_accounts(id);

CREATE INDEX idx_hotels_billing_account ON public.hotels (billing_account_id) WHERE billing_account_id IS NOT NULL;

-- 3. Billing Subscriptions (synced from Stripe via webhooks)
CREATE TABLE public.billing_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id      uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  provider_subscription_id text UNIQUE NOT NULL,
  plan_code               text NOT NULL,
  status                  text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired')),
  interval                text NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  amount                  integer NOT NULL DEFAULT 0,
  currency                text NOT NULL DEFAULT 'eur',
  trial_end               timestamptz,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_subs_account ON public.billing_subscriptions (billing_account_id);
CREATE INDEX idx_billing_subs_status ON public.billing_subscriptions (status) WHERE status IN ('active', 'trialing', 'past_due');
CREATE INDEX idx_billing_subs_provider ON public.billing_subscriptions (provider_subscription_id);

-- 4. Billing Events (webhook audit log — idempotency via provider_event_id)
CREATE TABLE public.billing_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL DEFAULT 'stripe',
  provider_event_id text UNIQUE NOT NULL,
  type              text NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}',
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'skipped'))
);

CREATE INDEX idx_billing_events_type ON public.billing_events (type);
CREATE INDEX idx_billing_events_status ON public.billing_events (status) WHERE status = 'pending';

-- 5. Plan Entitlements (what each plan includes)
CREATE TABLE public.plan_entitlements (
  plan_code             text PRIMARY KEY,
  name                  text NOT NULL,
  max_hotels            integer NOT NULL DEFAULT 1,
  max_users_per_hotel   integer NOT NULL DEFAULT 10,
  max_audits_per_month  integer NOT NULL DEFAULT 100,
  reports_enabled       boolean NOT NULL DEFAULT false,
  training_enabled      boolean NOT NULL DEFAULT false,
  analytics_enabled     boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Seed default plans
INSERT INTO public.plan_entitlements (plan_code, name, max_hotels, max_users_per_hotel, max_audits_per_month, reports_enabled, training_enabled, analytics_enabled) VALUES
  ('starter',      'Starter',      1,  10,  50,   false, false, false),
  ('professional', 'Professional', 3,  25,  500,  true,  true,  false),
  ('enterprise',   'Enterprise',   99, 999, 9999, true,  true,  true)
ON CONFLICT (plan_code) DO NOTHING;

-- 6. RLS Policies

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

-- Billing accounts: owner can read their own
CREATE POLICY billing_accounts_owner_select ON public.billing_accounts
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY billing_accounts_owner_update ON public.billing_accounts
  FOR UPDATE USING (owner_user_id = auth.uid());

-- Subscriptions: users can read subs for their billing account
CREATE POLICY billing_subs_owner_select ON public.billing_subscriptions
  FOR SELECT USING (
    billing_account_id IN (
      SELECT id FROM public.billing_accounts WHERE owner_user_id = auth.uid()
    )
  );

-- Events: no direct user access (server-only via service_role)
-- No SELECT policy = denied by default

-- Plan entitlements: readable by everyone (public info)
CREATE POLICY plan_entitlements_public_select ON public.plan_entitlements
  FOR SELECT USING (true);

-- 7. Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_accounts_updated_at
  BEFORE UPDATE ON public.billing_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
