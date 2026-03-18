alter table public.audit_runs
add column if not exists auditor_email text,
add column if not exists employee_number text;
