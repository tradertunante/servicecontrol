alter table public.audit_templates
  add column if not exists category text,
  add column if not exists language text not null default 'es';