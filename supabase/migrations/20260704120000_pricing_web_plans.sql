-- Alinea plan_entitlements con los planes públicos de la web
-- (Auditorías 195€ / Operaciones 259€ / Control Total 349€) y elimina el
-- catálogo antiguo starter/professional/enterprise que nunca se vendió.
-- Fuente de precios y packs: lib/billing/plans.ts

INSERT INTO public.plan_entitlements
  (plan_code, name, max_hotels, max_users_per_hotel, max_audits_per_month, reports_enabled, training_enabled, analytics_enabled)
VALUES
  ('auditoria',   'Auditorías',    1, 50,  1000, true, false, false),
  ('operaciones', 'Operaciones',   1, 100, 3000, true, true,  true),
  ('control',     'Control Total', 1, 250, 9999, true, true,  true)
ON CONFLICT (plan_code) DO UPDATE SET
  name = excluded.name,
  max_hotels = excluded.max_hotels,
  max_users_per_hotel = excluded.max_users_per_hotel,
  max_audits_per_month = excluded.max_audits_per_month,
  reports_enabled = excluded.reports_enabled,
  training_enabled = excluded.training_enabled,
  analytics_enabled = excluded.analytics_enabled;

-- Borrar los planes baratos solo si ninguna suscripción los referencia
-- (a fecha de esta migración no hay clientes; el guard es por seguridad).
DELETE FROM public.plan_entitlements pe
WHERE pe.plan_code IN ('starter', 'professional', 'enterprise')
  AND NOT EXISTS (
    SELECT 1 FROM public.billing_subscriptions bs WHERE bs.plan_code = pe.plan_code
  );
