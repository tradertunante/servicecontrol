alter table public.global_audit_packs
  add column if not exists default_area_name text;

update public.global_audit_packs
set default_area_name = 'ServiceControl Standards'
where name = 'ServiceControl Standards';