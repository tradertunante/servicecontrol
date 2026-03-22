-- ============================================================
-- RLS: department_backlog_items, hotel_departments, audit_logs
-- ============================================================

-- ------------------------------------------------------------
-- 1. department_backlog_items
-- ------------------------------------------------------------

alter table department_backlog_items enable row level security;

drop policy if exists "backlog_items_select_same_hotel" on department_backlog_items;
create policy "backlog_items_select_same_hotel"
  on department_backlog_items
  for select
  to authenticated
  using (sc_is_same_hotel(hotel_id));

-- INSERT / UPDATE / DELETE: default deny for authenticated; service_role bypasses RLS.

-- ------------------------------------------------------------
-- 2. hotel_departments
-- ------------------------------------------------------------

alter table hotel_departments enable row level security;

drop policy if exists "hotel_departments_select_same_hotel" on hotel_departments;
create policy "hotel_departments_select_same_hotel"
  on hotel_departments
  for select
  to authenticated
  using (sc_is_same_hotel(hotel_id));

-- INSERT / UPDATE / DELETE: default deny for authenticated; service_role bypasses RLS.

-- ------------------------------------------------------------
-- 3. audit_logs  (RLS already enabled — add SELECT policy only)
-- ------------------------------------------------------------

drop policy if exists "audit_logs_select_managers" on audit_logs;
create policy "audit_logs_select_managers"
  on audit_logs
  for select
  to authenticated
  using (
    sc_is_same_hotel(hotel_id)
    and sc_has_role(array['superadmin', 'admin', 'manager', 'quality'])
  );

-- INSERT / UPDATE / DELETE: write only via service_role (no policies).

-- ------------------------------------------------------------
-- 4. Index on audit_logs(actor_user_id)
-- ------------------------------------------------------------

create index if not exists idx_audit_logs_actor_user_id
  on audit_logs (actor_user_id);
