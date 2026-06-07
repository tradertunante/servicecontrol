insert into public.global_audit_packs (id, business_type, name, description, active)
values (
  gen_random_uuid(),
  'hotel',
  'ServiceControl Standards',
  'Estándares operativos nativos de ServiceControl para hoteles.',
  true
);