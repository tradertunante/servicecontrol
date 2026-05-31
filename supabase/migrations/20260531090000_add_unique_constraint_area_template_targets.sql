-- Add unique constraint required by the upsert onConflict in /api/admin/audit-targets
-- Without this constraint, all create/update operations on area_template_targets fail
-- with: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
ALTER TABLE public.area_template_targets
  ADD CONSTRAINT area_template_targets_hotel_area_template_period_key
  UNIQUE (hotel_id, area_id, audit_template_id, period);