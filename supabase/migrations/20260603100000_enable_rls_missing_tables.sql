-- Fix: enable RLS on tables that were missing it.
-- Both tables are accessed exclusively via service_role (supabaseAdmin),
-- which bypasses RLS. Enabling RLS with no policies means anon/authenticated
-- users are denied by default while service_role continues to work.

-- hotel_departments: created 2026-03-15, accessed via supabaseAdmin only.
alter table public.hotel_departments enable row level security;

-- admin_audit_log: created 2026-06-01, accessed via supabaseAdmin only.
alter table public.admin_audit_log enable row level security;