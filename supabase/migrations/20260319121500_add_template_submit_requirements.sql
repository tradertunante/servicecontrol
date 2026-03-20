alter table public.audit_templates
add column if not exists require_room_number boolean not null default false;

alter table public.audit_templates
add column if not exists require_audited_employee boolean not null default false;
