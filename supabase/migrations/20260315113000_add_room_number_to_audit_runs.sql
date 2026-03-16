alter table public.audit_runs
add column if not exists room_number text null;
