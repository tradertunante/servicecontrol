-- Critical indexes for dashboard and query performance at scale.
-- Without these, queries on audit_runs do sequential scans
-- that degrade from ~500ms (1K rows) to 10s+ (100K rows).

-- Dashboard: filters by hotel + status constantly
CREATE INDEX IF NOT EXISTS idx_audit_runs_hotel_status
  ON public.audit_runs (hotel_id, status);

-- Dashboard & area history: hotel + area + time ordering
CREATE INDEX IF NOT EXISTS idx_audit_runs_hotel_area_created
  ON public.audit_runs (hotel_id, area_id, executed_at DESC);

-- Audit loader: every answer lookup is by run_id
CREATE INDEX IF NOT EXISTS idx_audit_answers_run_id
  ON public.audit_answers (audit_run_id);

-- Team summary RPC: looks up targets by hotel + period + user
CREATE INDEX IF NOT EXISTS idx_area_template_assignments_lookup
  ON public.area_template_target_assignments (hotel_id, period, user_id)
  WHERE active = true;

-- Area access checks: frequently filtered by hotel
CREATE INDEX IF NOT EXISTS idx_user_area_access_hotel
  ON public.user_area_access (hotel_id);
